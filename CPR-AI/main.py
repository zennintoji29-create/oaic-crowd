"""
CPR AI Vision System - Master Application (CPR-AI/main.py)
Crowd Pressure Radar — Complete Hybrid AI + IoT Vision Module

Features:
- Multi-source adaptive video acquisition:
    * Auto-discovery across OS (AVFoundation on macOS, DirectShow on Windows, V4L2 on Linux)
    * USB camera preferred when connected, internal camera fallback
    * Synthetic realistic corridor fallback feed
    * Replay mode via `--video <path>` (e.g. PETS 2009 Benchmark - CC BY 4.0; MOT16/20)
- CLAHE adaptive low-light enhancement for dim corridors / exhibition halls.
- Metric Floor Homography:
    * 4-point perspective ground plane mapping (`cv2.getPerspectiveTransform`)
    * Calibrated real-world corridor dimensions (default 2m x 3m = 6.0 m²; bench 1.5m x 2m = 3.0 m²)
    * Uncalibrated mode fallback with "Relative Density (norm)"
- Fruin Level of Service & Compressive Crush Hazard Analytics:
    * Walkway LoS (Fruin 1971, HCM 2010): LoS C/D (0.72 p/m²), LoS D/E (1.08 p/m²) -> AMBER
    * Compressive Crush Hazard (Still 2014, Helbing 2007): >= 3.50 p/m² -> RED
    * Low-pass EMA density smoothing (alpha = 0.03 per frame) + Schmitt-trigger hysteresis (0.15 p/m²)
- Autonomous Camera Health Monitor:
    * Evaluates brightness, blur (Laplacian variance), inter-frame gaps
    * Zero detections only penalizes when optical signal is also abnormal (empty corridor is healthy!)
    * Debounce (1.5s) with exact measured failover latency from first bad frame
    * Return-to-primary anti-flap hysteresis (5.0s continuous healthy frames)
- Asynchronous non-blocking telemetry transmitter communicating with Express backend.

Controls:
  [e] Toggle Adaptive Low-Light Enhancement (ON/OFF)
  [w] Move Counting Line UP
  [s] Move Counting Line DOWN
  [r] Reset In/Out Counters
  [q] Graceful Shutdown
"""

import cv2
import time
import sys
import argparse
import os
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import torch
from ultralytics import YOLO

from config import cfg
from vision.camera import AdaptiveCamera, CameraHealthMonitor
from vision.movement import MovementTracker
from vision.line_counter import VirtualLineCounter
from vision.zones import HomographyZoneManager
from analytics.congestion import CongestionEstimator
from integration.backend import TelemetryClient


def parse_arguments():
    parser = argparse.ArgumentParser(description="CPR (Crowd Pressure Radar) Master AI Vision Engine")
    parser.add_argument("--source", type=str, default=None,
                        help="Camera source: 'auto', camera index integer (0, 1), stream URL, or file path.")
    parser.add_argument("--video", type=str, default=None,
                        help="Path to pre-recorded crowd video dataset (e.g. PETS 2009 benchmark, MOT16/20).")
    parser.add_argument("--uncalibrated", action="store_true",
                        help="Flag indicating footage lacks known metric dimensions. Reports Relative Density (norm).")
    parser.add_argument("--bench", action="store_true",
                        help="Use bench demo zone geometry (1.5m x 2.0m = 3.0 m²) instead of default (2.0m x 3.0m = 6.0 m²).")
    parser.add_argument("--ground-width", type=float, default=None,
                        help="Corridor ground plane width in meters.")
    parser.add_argument("--ground-length", type=float, default=None,
                        help="Corridor ground plane length in meters.")
    parser.add_argument("--stream-port", type=int, default=int(os.getenv("CPR_STREAM_PORT", "5000")),
                        help="Local HTTP MJPEG stream port for dashboard preview (default 5000, 0 disables).")
    parser.add_argument("--no-window", action="store_true",
                        help="Run headless without opening an OpenCV cv2.imshow GUI window.")
    return parser.parse_args()


class FrameBroadcaster:
    """Thread-safe holder for the latest annotated JPEG frame for HTTP MJPEG streaming."""
    def __init__(self):
        self._lock = threading.Lock()
        self._jpeg_bytes = None
        self._cond = threading.Condition(self._lock)

    def update(self, frame_bgr):
        ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            with self._cond:
                self._jpeg_bytes = buf.tobytes()
                self._cond.notify_all()

    def get_snapshot(self):
        with self._lock:
            return self._jpeg_bytes

    def wait_next(self, timeout=1.0):
        with self._cond:
            self._cond.wait(timeout=timeout)
            return self._jpeg_bytes


def start_mjpeg_server(port: int, broadcaster: FrameBroadcaster):
    class StreamHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = self.path.split("?")[0]
            if path in ("/", "/health"):
                payload = json.dumps({
                    "status": "running",
                    "video_feed": f"http://localhost:{port}/video_feed",
                    "snapshot": f"http://localhost:{port}/snapshot.jpg"
                }).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(payload)
            elif path == "/snapshot.jpg":
                jpg = broadcaster.get_snapshot()
                if not jpg:
                    self.send_error(503, "Camera frame not ready yet")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(jpg)
            elif path == "/video_feed":
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.end_headers()
                try:
                    while True:
                        jpg = broadcaster.wait_next(timeout=1.5)
                        if not jpg:
                            continue
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass
            else:
                self.send_error(404, "Not found")

        def log_message(self, format, *args):
            pass

    server = ThreadingHTTPServer(("0.0.0.0", port), StreamHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server


class CPRVisionMaster:
    def __init__(self, args=None):
        print("=" * 65)
        print("  CPR AI VISION SYSTEM (Crowd Pressure Radar) — v2.5 Fruin")
        print("=" * 65)

        self.args = args or parse_arguments()

        # 1. Determine Source and Calibration Settings
        if self.args.video:
            camera_source = self.args.video
            print(f"[CPR-Master] Replay Dataset Video Source: {camera_source}")
        elif self.args.source:
            camera_source = self.args.source
            print(f"[CPR-Master] Custom Video Source: {camera_source}")
        else:
            camera_source = cfg.camera_source

        if self.args.bench:
            self.ground_w = 1.5
            self.ground_l = 2.0
            print("[CPR-Master] Mode: BENCH DEMO ZONE (1.5m x 2.0m = 3.0 m²)")
        else:
            self.ground_w = self.args.ground_width if self.args.ground_width is not None else cfg.ground_width_m
            self.ground_l = self.args.ground_length if self.args.ground_length is not None else cfg.ground_length_m

        self.is_calibrated = False if self.args.uncalibrated else cfg.is_calibrated_geometry
        if not self.is_calibrated:
            print("[CPR-Master] Caution: Uncalibrated Geometry mode active. Output labeled as 'Relative Density (norm)'.")

        # 2. Hardware device assignment (Apple MPS / NVIDIA CUDA / CPU)
        if torch.cuda.is_available():
            self.device = "cuda:0"
            device_desc = torch.cuda.get_device_name(0)
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"
            device_desc = "Apple Silicon Metal Performance Shaders (MPS GPU)"
        else:
            self.device = "cpu"
            device_desc = "Standard CPU"
        print(f"[CPR-Master] Compute Backend: {self.device} ({device_desc})")

        # 3. Detector Model
        print(f"[CPR-Master] Loading YOLO model: {cfg.model_name}...")
        self.model = YOLO(cfg.model_name)
        self.model.to(self.device)
        print("[CPR-Master] YOLO model initialized.")

        # 4. Adaptive Camera Engine
        print(f"[CPR-Master] Initializing Video Source: {camera_source}...")
        self.camera = AdaptiveCamera(
            source=camera_source,
            req_width=cfg.frame_width,
            req_height=cfg.frame_height,
            prefer_external=cfg.prefer_external_camera,
            enable_clahe=cfg.enable_clahe,
            clahe_clip=cfg.clahe_clip_limit,
            gamma=cfg.gamma_correction
        )
        self.w = self.camera.actual_width or cfg.frame_width
        self.h = self.camera.actual_height or cfg.frame_height
        print(f"[CPR-Master] Stream Active: {self.w}x{self.h} | Low-Light Filter: {'ON' if self.camera.enable_clahe else 'OFF'}")

        # 5. Line Counter Geometry
        self.line_y_ratio = cfg.line_start_ratio[1]
        self._calculate_line_points()
        self.line_counter = VirtualLineCounter(
            self.line_p1, self.line_p2, 
            debounce_seconds=cfg.line_debounce_seconds
        )

        # 6. Planar Homography Zone & Congestion Analytics
        self.zone = HomographyZoneManager(
            zone_id=cfg.zone_id,
            calibration_corners_ratio=cfg.zone_calibration_corners,
            ground_width_m=self.ground_w,
            ground_length_m=self.ground_l,
            frame_w=self.w,
            frame_h=self.h,
            is_calibrated=self.is_calibrated
        )

        self.movement = MovementTracker(
            stationary_speed_thresh=cfg.stationary_speed_threshold_px,
            stationary_dwell_thresh=cfg.stationary_dwell_seconds,
            smoothing_window=cfg.speed_smoothing_window
        )

        self.congestion_evaluator = CongestionEstimator(
            ground_area_m2=self.zone.ground_area_m2,
            is_calibrated=self.zone.is_calibrated,
            fruin_amber_density=cfg.fruin_los_c_density,
            fruin_elevated_density=cfg.fruin_los_d_density,
            crush_hazard_density=cfg.crush_hazard_density,
            density_alpha=cfg.density_smoothing_alpha,
            hysteresis_band=cfg.density_hysteresis_band
        )

        # 7. Camera Health & Autonomous Failover Monitor
        self.health_monitor = CameraHealthMonitor(
            min_brightness=cfg.cam_health_min_brightness,
            max_brightness=cfg.cam_health_max_brightness,
            min_laplacian_var=cfg.cam_health_min_laplacian_var,
            max_interframe_gap_sec=cfg.cam_health_max_interframe_gap,
            failover_threshold=cfg.cam_health_failover_threshold,
            failover_debounce_sec=cfg.failover_debounce_seconds,
            recovery_hysteresis_sec=cfg.return_to_primary_seconds
        )
        self.last_measured_failover_latency = None

        # 8. Background Telemetry Client
        print(f"[CPR-Master] Connecting to Backend Telemetry: {cfg.backend_url}...")
        self.telemetry = TelemetryClient(
            backend_url=cfg.backend_url,
            auth_token=cfg.auth_token,
            send_rate_hz=cfg.telemetry_rate_hz
        )

        # FPS Buffer & MJPEG Broadcaster
        self.fps_buffer = []
        self.broadcaster = FrameBroadcaster()
        self.mjpeg_server = None
        if getattr(self.args, "stream_port", 0) > 0:
            try:
                self.mjpeg_server = start_mjpeg_server(self.args.stream_port, self.broadcaster)
                print(f"[CPR-Master] Live Browser Video Feed: http://localhost:{self.args.stream_port}/video_feed")
            except OSError as e:
                print(f"[CPR-Master] Warning: Could not bind MJPEG stream port {self.args.stream_port}: {e}")

    def _calculate_line_points(self):
        p1 = (int(self.w * cfg.line_start_ratio[0]), int(self.h * self.line_y_ratio))
        p2 = (int(self.w * cfg.line_end_ratio[0]), int(self.h * self.line_y_ratio))
        self.line_p1 = p1
        self.line_p2 = p2

    def _get_fruin_los_label(self, density: float) -> str:
        """Determines academic Fruin Walkway Level of Service rating."""
        if not self.is_calibrated:
            return "N/A (Relative)"
        if density < 0.31:
            return "LoS A (Free Flow)"
        elif density < 0.43:
            return "LoS B (Fluid Flow)"
        elif density < 0.72:
            return "LoS C (Normal Speed)"
        elif density < 1.08:
            return "LoS D (Restricted Flow)"
        elif density < 2.17:
            return "LoS E (Shuffling Queue)"
        elif density < 3.50:
            return "LoS F (Queue Jam)"
        else:
            return "CRUSH HAZARD (>3.5 p/m²)"

    def run(self):
        print("\n[CPR-Master] Vision pipeline started successfully.")
        print("  Press 'e' to toggle low-light boost | 'w'/'s' to adjust line | 'r' to reset | 'q' to quit.\n")

        while True:
            t0 = time.perf_counter()
            ret, frame = self.camera.read_frame()

            if not ret or frame is None:
                # Video file reached end -> loop or camera reconnecting
                if getattr(self.camera, 'is_video_file', False):
                    if self.camera.cap and self.camera.cap.isOpened():
                        self.camera.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                time.sleep(0.05)
                continue

            current_time = time.time()

            # Update resolution if stream changed
            if frame.shape[1] != self.w or frame.shape[0] != self.h:
                self.w, self.h = frame.shape[1], frame.shape[0]
                self._calculate_line_points()
                self.line_counter.update_geometry(self.line_p1, self.line_p2)
                self.zone.update_resolution(self.w, self.h)

            # 1. Run YOLO + ByteTrack Inference
            results = self.model.track(
                source=frame,
                persist=True,
                tracker=cfg.tracker_config,
                classes=[cfg.target_class_id],
                conf=cfg.confidence_threshold,
                iou=cfg.iou_threshold,
                device=self.device,
                verbose=False
            )

            current_centroids = {}
            raw_boxes = []

            # 2. Parse Detections & Trajectories
            if results and len(results) > 0 and results[0].boxes is not None:
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    conf = float(box.conf[0].cpu().numpy())
                    track_id = int(box.id[0].cpu().numpy()) if box.id is not None else None

                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    raw_boxes.append((x1, y1, x2, y2, conf, track_id, (cx, cy)))

                    if track_id is not None:
                        current_centroids[track_id] = (cx, cy)

            # 3. Optical Camera Health & Autonomous Failover Evaluation
            health_score, is_failover, latency_triggered, health_reason = self.health_monitor.evaluate(
                frame, len(raw_boxes), current_time
            )
            if latency_triggered is not None:
                self.last_measured_failover_latency = latency_triggered

            # 4. Geometric Crossing Evaluation
            for tid, (cx, cy) in current_centroids.items():
                existing_track = self.movement.get_track(tid)
                if existing_track and len(existing_track.positions) > 0:
                    prev_pt = (existing_track.positions[-1][0], existing_track.positions[-1][1])
                    self.line_counter.check_crossing(tid, prev_pt, (cx, cy), current_time)

            # Update movement positions and dwell timers
            self.movement.update_tracks(current_centroids, current_time)

            # 5. Planar Homography Zone Containment & Congestion Analytics
            zone_active_ids, ground_positions = self.zone.filter_occupancy(raw_boxes, self.movement.tracks)
            congestion_data = self.congestion_evaluator.evaluate(self.movement.tracks, zone_active_ids)
            fruin_los_str = self._get_fruin_los_label(congestion_data["density"])

            # 6. Non-Blocking Telemetry Broadcast
            effective_source = "degraded_hardware_failover" if is_failover else "computer_vision"
            telemetry_payload = {
                "deviceId": cfg.device_id,
                "zoneId": cfg.zone_id,
                "timestamp": int(current_time),
                "source": effective_source,
                "state": congestion_data["state"],
                "score": round(congestion_data["score"] * 100.0, 1),
                "density": congestion_data["density"],
                "densityRaw": congestion_data["density_raw"],
                "densityUnit": congestion_data["density_unit"],
                "isCalibrated": congestion_data["is_calibrated"],
                "groundAreaM2": congestion_data["ground_area_m2"],
                "fruinLoS": fruin_los_str,
                "avgSpeed": congestion_data["avg_speed"],
                "stopGoIndex": congestion_data["turbulence_index"],
                "targetCount": congestion_data["occupancy"],
                "entryCount": self.line_counter.entry_count,
                "exitCount": self.line_counter.exit_count,
                "activeAlerts": congestion_data["alerts"],
                "cameraHealth": round(health_score, 1),
                "cameraHealthReason": health_reason,
                "isFailover": is_failover,
                "failoverLatencySec": round(self.last_measured_failover_latency, 2) if self.last_measured_failover_latency else None,
                "firmwareVersion": cfg.firmware_version
            }
            self.telemetry.send_telemetry_async(telemetry_payload)

            # 7. Render Technical Visualization Overlay
            t1 = time.perf_counter()
            frame_time = t1 - t0
            fps = 1.0 / frame_time if frame_time > 0 else 0
            self.fps_buffer.append(fps)
            if len(self.fps_buffer) > 20:
                self.fps_buffer.pop(0)
            avg_fps = sum(self.fps_buffer) / len(self.fps_buffer)

            self._render_scene(
                frame, raw_boxes, zone_active_ids, ground_positions,
                congestion_data, fruin_los_str, health_score, is_failover,
                avg_fps, frame_time * 1000, current_time
            )

            self.broadcaster.update(frame)

            if not getattr(self.args, "no_window", False):
                cv2.imshow("CPR - Crowd Pressure Radar (Master Vision Engine)", frame)
                # 8. Keyboard Events
                key = cv2.waitKey(1) & 0xFF
            else:
                time.sleep(0.005)
                key = 255
            if key == ord('q'):
                break
            elif key == ord('e'):
                state = self.camera.toggle_enhancement()
                print(f"[CPR-Master] Adaptive Low-Light Enhancement: {'ON' if state else 'OFF'}")
            elif key == ord('r'):
                self.line_counter.entry_count = 0
                self.line_counter.exit_count = 0
                print("[CPR-Master] In/Out Counters reset.")
            elif key == ord('w'):
                self.line_y_ratio = max(0.15, self.line_y_ratio - 0.05)
                self._calculate_line_points()
                self.line_counter.update_geometry(self.line_p1, self.line_p2)
            elif key == ord('s'):
                self.line_y_ratio = min(0.85, self.line_y_ratio + 0.05)
                self._calculate_line_points()
                self.line_counter.update_geometry(self.line_p1, self.line_p2)

        self.cleanup()

    def _render_scene(
        self, frame, raw_boxes, zone_ids, ground_positions,
        congestion_data, fruin_los, health_score, is_failover,
        fps, latency_ms, current_time
    ):
        h, w = frame.shape[:2]

        # 1. Draw Ground Homography Corridor Boundary
        c_state = congestion_data["state"]
        zone_color = (
            cfg.COLOR_SAGE if c_state == "GREEN" else
            (cfg.COLOR_GOLD if c_state == "AMBER" else cfg.COLOR_RED)
        )
        self.zone.draw(frame, color=zone_color, alpha=0.15)

        # 2. Draw Counting Line
        recent_event = self.line_counter.get_recent_event_status(current_time)
        line_color = (50, 205, 50) if recent_event == "ENTRY" else ((20, 165, 255) if recent_event == "EXIT" else cfg.COLOR_GOLD)
        line_thick = 4 if recent_event else 2
        cv2.line(frame, self.line_p1, self.line_p2, line_color, line_thick, cv2.LINE_AA)
        cv2.putText(frame, "IN [v]", (self.line_p1[0] + 6, self.line_p1[1] + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (50, 205, 50), 1, cv2.LINE_AA)
        cv2.putText(frame, "OUT [^]", (self.line_p2[0] - 55, self.line_p2[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (20, 165, 255), 1, cv2.LINE_AA)

        # 3. Draw Tracked Persons, Foot Points, Motion Trails, and Badges
        for x1, y1, x2, y2, conf, track_id, (cx, cy) in raw_boxes:
            track = self.movement.get_track(track_id) if track_id else None
            in_zone = track_id in zone_ids if track_id else False

            # Bounding box color
            if track and track.is_stationary:
                box_color = cfg.COLOR_RED
            elif in_zone:
                box_color = cfg.COLOR_GOLD
            else:
                box_color = (200, 200, 200)

            # Draw Box
            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

            # Draw Foot Contact Point on Ground Plane
            foot_x, foot_y = int((x1 + x2) / 2), int(y2)
            cv2.circle(frame, (foot_x, foot_y), 4, (0, 255, 255), -1)

            # Draw Motion Trail
            if track and len(track.positions) > 1:
                pts = list(track.positions)
                for i in range(1, len(pts)):
                    cv2.line(frame, (pts[i-1][0], pts[i-1][1]), (pts[i][0], pts[i][1]), (0, 255, 255), 1, cv2.LINE_AA)

            # Badge Label with Ground Coordinates if in zone
            if track_id:
                dwell = f"{track.total_dwell_seconds:.0f}s" if track else "0s"
                gm = ground_positions.get(track_id)
                if gm:
                    badge = f"#{track_id} [{dwell}] ({gm[0]:.1f}m,{gm[1]:.1f}m)"
                else:
                    badge = f"#{track_id} [{dwell}]"
            else:
                badge = f"Person ({conf*100:.0f}%)"

            (tw, th), _ = cv2.getTextSize(badge, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            cv2.rectangle(frame, (x1, max(0, y1 - 18)), (x1 + tw + 6, max(18, y1)), box_color, -1)
            cv2.putText(frame, badge, (x1 + 3, max(14, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 0, 0), 1, cv2.LINE_AA)

        # 4. Top Technical Header HUD (Color Hunt Palette: Charcoal #45474B)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 38), cfg.COLOR_CHARCOAL, -1)
        cv2.rectangle(overlay, (0, h - 38), (w, h), cfg.COLOR_CHARCOAL, -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        # Header Details
        cv2.putText(frame, "CPR RADAR v2.5", (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.52, cfg.COLOR_GOLD, 2, cv2.LINE_AA)

        # Health & Failover Badge
        if is_failover:
            fail_msg = f"MODE: FAILOVER (Degraded)"
            if self.last_measured_failover_latency:
                fail_msg += f" [{self.last_measured_failover_latency:.2f}s]"
            cv2.putText(frame, fail_msg, (160, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (40, 40, 255), 2, cv2.LINE_AA)
        else:
            h_color = (50, 205, 50) if health_score >= 80 else ((20, 206, 244) if health_score >= 50 else (40, 40, 255))
            cv2.putText(frame, f"CAM HEALTH: {health_score:.0f}%", (160, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, h_color, 1, cv2.LINE_AA)

        # Fruin Level of Service Badge
        cv2.putText(frame, f"LOS: {fruin_los}", (320, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, cfg.COLOR_WHITE, 1, cv2.LINE_AA)

        perf_label = f"{fps:.1f} FPS ({latency_ms:.0f}ms)"
        cv2.putText(frame, perf_label, (w - 165, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, cfg.COLOR_WHITE, 1, cv2.LINE_AA)

        # 5. Bottom Telemetry Bar
        cv2.putText(frame, f"IN: {self.line_counter.entry_count}", (10, h - 13), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (50, 205, 50), 2, cv2.LINE_AA)
        cv2.putText(frame, f"OUT: {self.line_counter.exit_count}", (85, h - 13), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (20, 165, 255), 2, cv2.LINE_AA)

        unit_str = "p/m²" if self.is_calibrated else "rel"
        cv2.putText(frame, f"OCCUPANCY: {congestion_data['occupancy']} ({congestion_data['density']:.2f} {unit_str})",
                    (165, h - 13), cv2.FONT_HERSHEY_SIMPLEX, 0.46, cfg.COLOR_WHITE, 1, cv2.LINE_AA)

        # Congestion State Badge
        c_color = cfg.COLOR_SAGE if c_state == "GREEN" else (cfg.COLOR_GOLD if c_state == "AMBER" else cfg.COLOR_RED)
        cv2.putText(frame, f"STATE: {c_state}", (w - 130, h - 13), cv2.FONT_HERSHEY_SIMPLEX, 0.50, c_color, 2, cv2.LINE_AA)

    def cleanup(self):
        if self.mjpeg_server:
            try:
                self.mjpeg_server.shutdown()
            except Exception:
                pass
        self.camera.release()
        self.telemetry.stop()
        if not getattr(self.args, "no_window", False):
            cv2.destroyAllWindows()
        print("[CPR-Master] All resources released.")


if __name__ == "__main__":
    args = parse_arguments()
    master = CPRVisionMaster(args)
    master.run()
