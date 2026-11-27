"""
CPR AI Vision System - Stage 1: YOLO Person Detection + ByteTrack Multi-Person Tracking
Features:
- Automatic CUDA GPU detection with fallback to CPU / Apple MPS.
- Ultralytics YOLO (YOLO11n default) strictly filtered to class 0 ('person').
- ByteTrack integration with persistent anonymous Track ID assignment.
- Technical HUD overlay (FPS, Device, Person Count, Tracked IDs).
"""

import argparse
import cv2
import time
import sys
import os
from pathlib import Path
import torch
from ultralytics import YOLO

# Ensure CPR-AI root is on sys.path for local imports
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from vision.stream import FrameBroadcaster, start_mjpeg_server
from vision.line_counter import VirtualLineCounter
from vision.movement import MovementTracker

try:
    from integration.backend import TelemetryClient
except ImportError:
    TelemetryClient = None


def open_webcam(preferred_index: int | None = None):
    """Try physical webcam indices using Windows/OS native capture backends."""
    indices = [preferred_index] if preferred_index is not None else [0, 1, 2]
    if sys.platform.startswith("win"):
        backends = [("DirectShow", cv2.CAP_DSHOW), ("MediaFoundation", cv2.CAP_MSMF), ("Default", cv2.CAP_ANY)]
    else:
        backends = [("Default", cv2.CAP_ANY)]

    for idx in indices:
        for b_name, b_code in backends:
            cap = cv2.VideoCapture(idx, b_code)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    return cap, idx, b_name
            cap.release()
    return None, None, None


class CPRPersonTracker:
    def __init__(
        self,
        model_name: str = "yolo11n.pt",
        camera_index: int | None = None,
        conf_threshold: float = 0.45,
        backend_url: str = "http://localhost:3000/api/telemetry",
        stream_port: int = 5000,
        zone_id: str = "zone-entry-a",
    ):
        self.conf_threshold = conf_threshold
        self.backend_url = os.getenv("CPR_BACKEND_URL", backend_url)
        self.auth_token = os.getenv("CPR_AUTH_KEY", "cpr-secret-key-2026")
        self.stream_port = stream_port
        self.zone_id = os.getenv("CPR_ZONE_ID", zone_id)

        # 1. Device Resolution (CUDA -> MPS -> CPU)
        self.device = self._resolve_compute_device()
        print(f"[CPR-Tracker] Target Compute Device: {self.device}")

        # 2. Model Initialization
        print(f"[CPR-Tracker] Loading YOLO detector: {model_name}...")
        self.model = YOLO(model_name)
        self.model.to(self.device)
        print("[CPR-Tracker] Model loaded successfully.")

        # 3. Telemetry Client (Connects to Express Backend)
        self.telemetry = None
        if TelemetryClient:
            try:
                self.telemetry = TelemetryClient(self.backend_url, self.auth_token, send_rate_hz=3.0)
                print(f"[CPR-Tracker] Telemetry Client initialized -> {self.backend_url}")
            except Exception as e:
                print(f"[CPR-Tracker] Warning: Telemetry failed to initialize: {e}")

        # 4. Physical Webcam Setup
        self.cap, found_idx, found_backend = open_webcam(camera_index)
        if self.cap is None:
            raise RuntimeError(
                "No working physical webcam found on indices 0-2. "
                "Plug in your USB/built-in camera, allow Windows Camera access, and retry."
            )

        self.camera_index = found_idx
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        self.frame_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.frame_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"[CPR-Tracker] Webcam opened (Index {found_idx}, {found_backend}): {self.frame_width}x{self.frame_height}")

        # 5. Live HTTP MJPEG Stream Server for Dashboard / Browser
        self.broadcaster = FrameBroadcaster()
        self.mjpeg_server = None
        if self.stream_port > 0:
            try:
                self.mjpeg_server = start_mjpeg_server(self.stream_port, self.broadcaster)
            except OSError as e:
                print(f"[CPR-Tracker] Warning: Could not bind stream port {self.stream_port}: {e}")

        # Performance tracking & Sensor/Vision Fusion modules
        self.fps_history = []
        self.prev_time = time.perf_counter()
        self.prev_centroids = {}
        line_y = max(120, self.frame_height // 2)
        self.line_counter = VirtualLineCounter(
            start_pt=(40, line_y),
            end_pt=(max(200, self.frame_width - 40), line_y),
            debounce_seconds=1.5,
        )
        self.movement_tracker = MovementTracker(
            stationary_speed_thresh=25.0,
            stationary_dwell_thresh=3.0,
        )
        self._clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

    def _assess_optical_health(self, frame) -> tuple[str, float, float]:
        """Evaluates frame luminance and Laplacian sharpness for optical failure watchdog."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = float(gray.mean())
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if brightness < 28.0:
            return "DARKNESS_DETECTED", brightness, sharpness
        if sharpness < 18.0:
            return "BLUR_OR_OCCLUSION", brightness, sharpness
        return "HEALTHY", brightness, sharpness

    def _enhance_low_light(self, frame):
        """Applies CLAHE on luminance channel for low-light YOLO detection."""
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        l_eq = self._clahe.apply(l_chan)
        return cv2.cvtColor(cv2.merge((l_eq, a_chan, b_chan)), cv2.COLOR_LAB2BGR)

    def _resolve_compute_device(self) -> str:
        """Autodetects NVIDIA CUDA, Apple Silicon MPS, or CPU."""
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            print(f"[CPR-Tracker] GPU Acceleration: ENABLED ({gpu_name})")
            return "cuda:0"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            print("[CPR-Tracker] Apple Silicon GPU: ENABLED (MPS)")
            return "mps"
        else:
            print("[CPR-Tracker] WARNING: GPU not available. Running on CPU.")
            return "cpu"

    def run(self):
        print("\n" + "=" * 65)
        print("  CPR AI Crowd Pressure Radar — Webcam People Counter")
        if self.mjpeg_server:
            print(f"  CAMERA STREAM PORT : {self.stream_port}")
            print(f"  LIVE YOLO FEED URL : http://localhost:{self.stream_port}/video_feed")
            print(f"  SNAPSHOT URL       : http://localhost:{self.stream_port}/snapshot.jpg")
        print(f"  ACTIVE ZONE / GATE : {self.zone_id}")
        print(f"    Gate A (default) → python stage1_tracker.py --zone zone-entry-a")
        print(f"    Gate B           → python stage1_tracker.py --zone zone-corridor-b")
        print("  Controls: Press 'q' in the camera window to quit")
        print("=" * 65 + "\n")
        try:
            cv2.namedWindow("CPR - Crowd Pressure Radar (Vision Engine)", cv2.WINDOW_NORMAL)
        except cv2.error:
            pass

        while True:
            t0 = time.perf_counter()
            now_ts = time.time()
            ret, frame = self.cap.read()
            if not ret:
                print("[ERROR] Camera frame drop detected. Attempting to recover...")
                time.sleep(0.1)
                continue

            # Optical Watchdog: check darkness / blur / occlusion
            optical_health, brightness, sharpness = self._assess_optical_health(frame)
            infer_frame = self._enhance_low_light(frame) if optical_health == "DARKNESS_DETECTED" else frame

            # Run YOLO + ByteTrack
            # classes=[0] filters COCO class 0 ('person') directly in tensors
            # persist=True preserves IDs across frames in ByteTrack
            results = self.model.track(
                source=infer_frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=[0],
                conf=self.conf_threshold,
                device=self.device,
                verbose=False
            )

            current_people_count = 0
            tracked_ids = []
            current_centroids = {}

            # Parse bounding boxes and ByteTrack IDs
            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    # Coordinates in integer pixels
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    conf = float(box.conf[0].cpu().numpy())
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    
                    # Track ID (None if detection not yet confirmed by ByteTrack)
                    track_id = int(box.id[0].cpu().numpy()) if box.id is not None else None
                    
                    current_people_count += 1
                    if track_id is not None:
                        tracked_ids.append(track_id)
                        current_centroids[track_id] = (cx, cy)
                        if track_id in self.prev_centroids:
                            self.line_counter.check_crossing(
                                track_id, self.prev_centroids[track_id], (cx, cy), now_ts
                            )
                        self.prev_centroids[track_id] = (cx, cy)

                    # Bounding Box Color Coding:
                    # High confidence: Cyan/Teal (#00E5FF), Lower: Light Blue
                    box_color = (255, 229, 0) if track_id is not None else (120, 120, 120)

                    # Draw Bounding Box & Centroid
                    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                    cv2.circle(frame, (cx, cy), 4, (0, 255, 180), -1)

                    # Draw Track Badge
                    badge_text = f"ID #{track_id} ({conf*100:.0f}%)" if track_id is not None else f"Person ({conf*100:.0f}%)"
                    (w_text, h_text), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    
                    # Badge background
                    cv2.rectangle(frame, (x1, y1 - 20), (x1 + w_text + 8, y1), box_color, -1)
                    cv2.putText(frame, badge_text, (x1 + 4, y1 - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

            # Update movement & stop-go metrics
            self.movement_tracker.update_tracks(current_centroids, now_ts)
            stationary_count = self.movement_tracker.get_stationary_count()
            speeds = [
                t.speed_px_per_sec for t in self.movement_tracker.tracks.values()
                if t.track_id in current_centroids
            ]
            avg_speed_mps = round((sum(speeds) / len(speeds)) / 120.0, 2) if speeds else 1.2
            stop_go_index = round(stationary_count / max(1, current_people_count), 2) if current_people_count > 0 else 0.0

            # Prune stale centroids
            for tid in list(self.prev_centroids.keys()):
                if tid not in current_centroids and tid not in self.movement_tracker.tracks:
                    del self.prev_centroids[tid]

            # Draw virtual entry/exit counting line
            recent_evt = self.line_counter.get_recent_event_status(now_ts)
            line_color = (0, 255, 128) if recent_evt == "ENTRY" else ((0, 165, 255) if recent_evt == "EXIT" else (24, 226, 153))
            cv2.line(frame, self.line_counter.p1, self.line_counter.p2, line_color, 2)
            cv2.putText(frame, "VIRTUAL COUNTING LINE (IN v / OUT ^)", (self.line_counter.p1[0], self.line_counter.p1[1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, line_color, 1, cv2.LINE_AA)

            active_alerts = []
            if optical_health == "DARKNESS_DETECTED":
                active_alerts.append("OPTICAL_DARKNESS")
            elif optical_health == "BLUR_OR_OCCLUSION":
                active_alerts.append("OPTICAL_BLUR")
            if stationary_count >= 3:
                active_alerts.append("CROWD_STALL_DETECTED")

            net_inside = max(0, self.line_counter.entry_count - self.line_counter.exit_count)
            effective_count = max(current_people_count, net_inside) if current_people_count > 0 else net_inside

            # 4. Asynchronous Telemetry Dispatch to Express Backend (Render / Local)
            if self.telemetry:
                self.telemetry.send_telemetry_async({
                    "deviceId": "cpr-vision-gate-01",
                    "zoneId": self.zone_id,
                    "timestamp": int(now_ts * 1000),
                    "source": "computer_vision",
                    "targetCount": current_people_count,
                    "count": current_people_count,
                    "entryCount": self.line_counter.entry_count,
                    "exitCount": self.line_counter.exit_count,
                    "avgSpeed": avg_speed_mps,
                    "stopGoIndex": stop_go_index,
                    "opticalHealth": optical_health,
                    "activeAlerts": active_alerts,
                    "visiblePersons": current_people_count,
                    "activeTrackIds": tracked_ids,
                    "score": round(min(100.0, effective_count * 10.0 + (stop_go_index * 15.0)), 1),
                    "state": "RED" if current_people_count >= 10 else ("AMBER" if current_people_count >= 5 else "GREEN")
                })

            # Compute actual inference + rendering FPS
            t1 = time.perf_counter()
            frame_time = t1 - t0
            current_fps = 1.0 / frame_time if frame_time > 0 else 0
            self.fps_history.append(current_fps)
            if len(self.fps_history) > 30:
                self.fps_history.pop(0)
            avg_fps = sum(self.fps_history) / len(self.fps_history)

            # Draw Technical Monitoring HUD
            self._draw_monitoring_hud(
                frame, current_people_count, tracked_ids, avg_fps, frame_time,
                self.line_counter.entry_count, self.line_counter.exit_count, optical_health
            )
            self.broadcaster.update(frame)

            try:
                cv2.imshow("CPR - Crowd Pressure Radar (Vision Engine)", frame)
            except cv2.error as e:
                # Fallback if headless OpenCV without highgui is loaded
                pass
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("[CPR-Tracker] User requested shutdown.")
                break

        self.cleanup()

    def _draw_monitoring_hud(
        self,
        frame,
        count: int,
        ids: list,
        fps: float,
        latency: float,
        entry_count: int = 0,
        exit_count: int = 0,
        optical_health: str = "HEALTHY",
    ):
        """Draws an enterprise cybersecurity/IoT technical monitoring HUD."""
        h, w = frame.shape[:2]

        # Top Control Banner (Semi-transparent black)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 48), (15, 23, 42), -1)
        # Bottom Telemetry Bar
        cv2.rectangle(overlay, (0, h - 36), (w, h), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

        # Title & System Badge
        cv2.putText(frame, "CPR VISION SYSTEM", (16, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2, cv2.LINE_AA)
        opt_color = (0, 255, 128) if optical_health == "HEALTHY" else (0, 165, 255)
        cv2.putText(frame, f"OPTICAL: {optical_health}", (225, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, opt_color, 1, cv2.LINE_AA)

        # Backend Telemetry Network Status
        is_online = bool(self.telemetry and self.telemetry.is_connected)
        net_label = "NET: ONLINE (3000)" if is_online else "NET: CONNECTING"
        net_color = (0, 255, 0) if is_online else (148, 163, 184)
        cv2.putText(frame, net_label, (w - 610, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, net_color, 1, cv2.LINE_AA)

        # Compute Device Indicator
        dev_color = (0, 255, 0) if "cuda" in self.device else (0, 165, 255)
        dev_label = f"BACKEND: {self.device.upper()}"
        cv2.putText(frame, dev_label, (w - 240, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, dev_color, 1, cv2.LINE_AA)

        # FPS & Inference Latency
        fps_label = f"FPS: {fps:.1f} ({latency*1000:.1f}ms)"
        cv2.putText(frame, fps_label, (w - 430, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        # Bottom Bar: Person Count, Entry/Exit/Net Flow & Active Track IDs
        net_inside = max(0, entry_count - exit_count)
        count_color = (0, 255, 0) if count < 5 else ((0, 165, 255) if count < 10 else (0, 0, 255))
        cv2.putText(frame, f"VISIBLE: {count}", (16, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, count_color, 2, cv2.LINE_AA)

        cv2.putText(frame, f"IN: {entry_count}  OUT: {exit_count}  NET: {net_inside}", (155, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (24, 226, 153), 1, cv2.LINE_AA)

        id_str = ", ".join(map(str, ids[:6])) + ("..." if len(ids) > 6 else "")
        cv2.putText(frame, f"IDS: [{id_str}]", (440, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (203, 213, 225), 1, cv2.LINE_AA)

    def cleanup(self):
        if self.mjpeg_server:
            try:
                self.mjpeg_server.shutdown()
            except Exception:
                pass
        if self.telemetry:
            self.telemetry.stop()
        self.cap.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        print("[CPR-Tracker] Camera released. Resources cleared.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CPR AI Webcam YOLO People Counter")
    parser.add_argument("--camera", type=int, default=None, help="Webcam index (default: auto-detect 0..2)")
    parser.add_argument(
        "--stream-port",
        type=int,
        default=int(os.getenv("CPR_STREAM_PORT", "5000")),
        help="HTTP MJPEG stream port (default 5000, 0 disables)",
    )
    parser.add_argument(
        "--zone",
        type=str,
        default=os.getenv("CPR_ZONE_ID", "zone-entry-a"),
        help="Zone/gate ID to report telemetry to. Gate A: zone-entry-a (default), Gate B: zone-corridor-b",
    )
    args = parser.parse_args()
    tracker = CPRPersonTracker(
        model_name="yolo11n.pt",
        camera_index=args.camera,
        conf_threshold=0.45,
        stream_port=args.stream_port,
        zone_id=args.zone,
    )
    tracker.run()
