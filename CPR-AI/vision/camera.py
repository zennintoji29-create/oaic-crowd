"""
CPR AI Vision System - Multi-Source Camera Stream Engine
Cross-Platform Universal Auto-Discovery Engine (macOS, Windows, Linux)

Features:
- Universal Auto-Discovery ("auto"): Automatically detects whether a USB camera or
  built-in laptop camera is plugged in across any OS without manual configuration.
- Native OS Acceleration:
    * macOS: Uses native AVFoundation (cv2.CAP_AVFOUNDATION)
    * Windows: Uses DirectShow (cv2.CAP_DSHOW) or MediaFoundation (cv2.CAP_MSMF)
    * Linux: Uses Video4Linux2 (cv2.CAP_V4L2)
- Multi-Camera Preference: Automatically detects external USB cameras vs built-in cameras.
- Zero-Crash Fail-safe: If no camera is currently accessible or permissions are pending,
  activates a synthetic simulated corridor feed while continuously polling for physical
  camera connection in a background thread, hot-swapping instantly once connected.
- Adaptive Preprocessing: Optional CLAHE and gamma boost for low-light queue corridors.
"""
import os
import sys
import time
import threading
import numpy as np
import cv2
from typing import Optional, Tuple, List, Dict, Any


class _SuppressStderr:
    """Temporarily suppresses low-level C/C++ stderr during camera probing."""
    def __enter__(self):
        try:
            self.null_fd = os.open(os.devnull, os.O_RDWR)
            self.save_fd = os.dup(2)
            os.dup2(self.null_fd, 2)
        except Exception:
            self.null_fd = None
        return self

    def __exit__(self, *_):
        if getattr(self, "null_fd", None) is not None:
            try:
                os.dup2(self.save_fd, 2)
                os.close(self.save_fd)
                os.close(self.null_fd)
            except Exception:
                pass


def get_platform_backends() -> List[Tuple[str, int]]:
    """Returns ordered list of (backend_name, cv2_enum) suitable for the current operating system."""
    if sys.platform == "darwin":
        # macOS: AVFoundation first, then Default
        return [("AVFoundation", getattr(cv2, "CAP_AVFOUNDATION", cv2.CAP_ANY)), ("Default", cv2.CAP_ANY)]
    elif sys.platform.startswith("win"):
        # Windows: DirectShow for lowest latency USB webcam capture, MSMF fallback
        backends = []
        if hasattr(cv2, "CAP_DSHOW"):
            backends.append(("DirectShow", cv2.CAP_DSHOW))
        if hasattr(cv2, "CAP_MSMF"):
            backends.append(("MediaFoundation", cv2.CAP_MSMF))
        backends.append(("Default", cv2.CAP_ANY))
        return backends
    else:
        # Linux: V4L2 then Default
        backends = []
        if hasattr(cv2, "CAP_V4L2"):
            backends.append(("V4L2", cv2.CAP_V4L2))
        backends.append(("Default", cv2.CAP_ANY))
        return backends


def discover_available_cameras(max_probe: int = 4) -> List[Dict[str, Any]]:
    """
    Probes camera indices 0 through max_probe-1 on the current OS.
    Verifies that a frame can actually be captured (to eliminate dummy/idle devices).
    """
    working_cameras = []
    backends = get_platform_backends()

    with _SuppressStderr():
        for idx in range(max_probe):
            for name, b_code in backends:
                try:
                    cap = cv2.VideoCapture(idx, b_code)
                    if cap.isOpened():
                        ret, frame = cap.read()
                        if ret and frame is not None and frame.size > 0:
                            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            working_cameras.append({
                                "index": idx,
                                "backend_name": name,
                                "backend_code": b_code,
                                "width": w,
                                "height": h
                            })
                            cap.release()
                            break
                    cap.release()
                except Exception:
                    pass

    return working_cameras


class SyntheticCorridorFeed:
    """Generates synthetic corridor crowd frames when no physical camera is plugged in."""
    def __init__(self, width: int = 640, height: int = 480):
        self.width = width
        self.height = height
        self.step = 0
        # Simulated pedestrian particles
        self.pedestrians = [
            {"x": 180, "y": 60, "vx": 0.4, "vy": 1.2, "radius": 14, "color": (160, 200, 180)},
            {"x": 420, "y": 90, "vx": -0.3, "vy": 1.5, "radius": 15, "color": (210, 190, 150)},
            {"x": 300, "y": 20, "vx": 0.1, "vy": 1.0, "radius": 13, "color": (180, 170, 220)},
        ]

    def get_frame(self) -> np.ndarray:
        self.step += 1
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)

        # Draw corridor floor & perspective guidelines
        cv2.rectangle(frame, (0, 0), (self.width, self.height), (35, 38, 42), -1)
        cv2.line(frame, (int(self.width * 0.1), 0), (0, self.height), (60, 65, 70), 2)
        cv2.line(frame, (int(self.width * 0.9), 0), (self.width, self.height), (60, 65, 70), 2)

        # Move simulated pedestrians
        for p in self.pedestrians:
            p["x"] += p["vx"]
            p["y"] += p["vy"]
            if p["y"] > self.height + 30:
                p["y"] = -20
                p["x"] = float(np.random.randint(int(self.width * 0.2), int(self.width * 0.8)))

            # Draw pedestrian head & torso silhouette
            cx, cy = int(p["x"]), int(p["y"])
            r = p["radius"]
            cv2.circle(frame, (cx, cy), r, p["color"], -1)
            cv2.ellipse(frame, (cx, cy + r + 10), (int(r * 1.3), int(r * 1.8)), 0, 0, 360, p["color"], -1)

        # Banner overlay indicating simulation mode
        cv2.rectangle(frame, (0, 0), (self.width, 32), (25, 28, 32), -1)
        cv2.putText(
            frame,
            "[SIMULATION FEED] Searching for physical USB/Built-in Camera...",
            (15, 21),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (20, 206, 244),  # Vibrant yellow accent (#F4CE14 in BGR)
            1,
            cv2.LINE_AA
        )
        return frame


class AdaptiveCamera:
    def __init__(self, source: str = "auto", req_width: int = 640, req_height: int = 480,
                 prefer_external: bool = True, enable_clahe: bool = True,
                 clahe_clip: float = 2.2, gamma: float = 1.15):
        self.source_str = str(source).strip()
        self.req_width = req_width
        self.req_height = req_height
        self.prefer_external = prefer_external

        # Preprocessing
        self.enable_clahe = enable_clahe
        self.clahe_clip = clahe_clip
        self.gamma = gamma
        self.clahe = cv2.createCLAHE(clipLimit=self.clahe_clip, tileGridSize=(8, 8)) if enable_clahe else None
        inv_gamma = 1.0 / self.gamma
        self.gamma_lut = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype("uint8")

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_connected: bool = False
        self.is_synthetic: bool = False
        self.actual_width: int = 0
        self.actual_height: int = 0
        self.is_video_file: bool = False
        self.device_desc: str = "Uninitialized"

        # Synthetic generator fallback
        self.synthetic_feed = SyntheticCorridorFeed(req_width, req_height)

        # Background re-discovery thread
        self._bg_thread_running = False
        self._stop_bg_thread = threading.Event()

        self._connect()

    def _connect(self) -> bool:
        """Connects to the appropriate camera source across macOS, Windows, or Linux."""
        # Check if source is a video file or stream URL
        is_file_or_url = (
            self.source_str.startswith(("http://", "https://", "rtsp://", "udp://"))
            or self.source_str.lower().endswith((".mp4", ".avi", ".mkv", ".mov", ".m4v"))
        )

        if is_file_or_url:
            self.cap = cv2.VideoCapture(self.source_str)
            self.is_video_file = not self.source_str.startswith(("http://", "https://", "rtsp://", "udp://"))
            if self.cap.isOpened():
                self.actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.req_width
                self.actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.req_height
                self.is_connected = True
                self.is_synthetic = False
                self.device_desc = f"Stream/File ({self.source_str})"
                print(f"[CPR-Camera] Successfully opened video stream: {self.source_str}")
                return True
            else:
                print(f"[CPR-Camera] Failed to open video stream/file: {self.source_str}")

        # Auto-Discovery mode or numeric index
        is_auto = self.source_str.lower() in ("auto", "any", "detect", "default")
        chosen_index = None
        chosen_backend = cv2.CAP_ANY
        chosen_backend_name = "Default"

        cameras = discover_available_cameras(max_probe=4)

        if cameras:
            if is_auto:
                # If multiple cameras are connected and prefer_external is True,
                # prefer index > 0 (external USB camera) over index 0 (internal webcam)
                if len(cameras) > 1 and self.prefer_external:
                    # Select last index (typically USB camera)
                    cam = cameras[-1]
                    print(f"[CPR-Camera] Detected {len(cameras)} cameras. Selecting External USB Camera (Index {cam['index']}).")
                else:
                    cam = cameras[0]
                    print(f"[CPR-Camera] Selecting Camera (Index {cam['index']}).")
                chosen_index = cam["index"]
                chosen_backend = cam["backend_code"]
                chosen_backend_name = cam["backend_name"]
            else:
                try:
                    req_idx = int(self.source_str)
                    match = next((c for c in cameras if c["index"] == req_idx), None)
                    if match:
                        chosen_index = match["index"]
                        chosen_backend = match["backend_code"]
                        chosen_backend_name = match["backend_name"]
                    else:
                        print(f"[CPR-Camera] Camera index {req_idx} not found. Falling back to index {cameras[0]['index']}.")
                        chosen_index = cameras[0]["index"]
                        chosen_backend = cameras[0]["backend_code"]
                        chosen_backend_name = cameras[0]["backend_name"]
                except ValueError:
                    chosen_index = cameras[0]["index"]
                    chosen_backend = cameras[0]["backend_code"]
                    chosen_backend_name = cameras[0]["backend_name"]

        if chosen_index is not None:
            self.cap = cv2.VideoCapture(chosen_index, chosen_backend)
            if self.cap.isOpened():
                # Attempt to set requested resolution and high framerate
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.req_width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.req_height)
                self.cap.set(cv2.CAP_PROP_FPS, 30)

                self.actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.req_width
                self.actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.req_height
                self.is_connected = True
                self.is_synthetic = False
                cam_type = "External USB Camera" if chosen_index > 0 else "Primary / Built-in Camera"
                self.device_desc = f"{cam_type} (Index {chosen_index}, {chosen_backend_name})"
                print(f"[CPR-Camera] Connected: {self.device_desc} @ {self.actual_width}x{self.actual_height}")
                return True

        # Fallback to Synthetic Simulation Feed if no hardware camera could be opened
        self.is_connected = True
        self.is_synthetic = True
        self.actual_width = self.req_width
        self.actual_height = self.req_height
        self.device_desc = "Synthetic Corridor Feed (Zero-Crash Fallback)"
        print("[CPR-Camera] No active physical camera detected.")
        if sys.platform == "darwin":
            print("             macOS Note: Ensure Camera permission is granted to your Terminal/IDE in:")
            print("                         System Settings -> Privacy & Security -> Camera")
        print("[CPR-Camera] Running in resilient Simulation Mode (auto-probing for USB/Built-in in background)...")
        self._start_background_scanner()
        return True

    def _start_background_scanner(self):
        """Starts a background daemon thread to detect when a camera is plugged in."""
        if self._bg_thread_running:
            return
        self._bg_thread_running = True
        self._stop_bg_thread.clear()

        def scan_loop():
            while not self._stop_bg_thread.is_set():
                time.sleep(2.0)
                if self.is_synthetic or not self.is_connected:
                    cams = discover_available_cameras(max_probe=3)
                    if cams:
                        print(f"\n[CPR-Camera] Physical camera detected! Hot-swapping to Index {cams[0]['index']}...")
                        self.release()
                        if self._connect():
                            break

            self._bg_thread_running = False

        t = threading.Thread(target=scan_loop, daemon=True)
        t.start()

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Reads next frame. Transparently handles physical cameras, video loops, and synthetic feed."""
        if self.is_synthetic:
            frame = self.synthetic_feed.get_frame()
            return True, frame

        if not self.is_connected or self.cap is None:
            if not self._connect():
                return True, self.synthetic_feed.get_frame()

        ret, frame = self.cap.read()

        # Handle video file looping
        if not ret and self.is_video_file:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()

        # Disconnection detection (e.g. USB camera unplugged mid-session)
        if not ret or frame is None:
            print("[CPR-Camera] Frame read failed. Transitioning to auto-reconnect...")
            self.is_connected = False
            self.is_synthetic = True
            self._start_background_scanner()
            return True, self.synthetic_feed.get_frame()

        # Apply low-light preprocessing if enabled
        if self.enable_clahe:
            frame = self._enhance_frame(frame)

        return True, frame

    def _enhance_frame(self, frame: np.ndarray) -> np.ndarray:
        """Applies adaptive histogram equalization and gamma boost."""
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l_clahe = self.clahe.apply(l)
        enhanced_lab = cv2.merge((l_clahe, a, b))
        bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        if abs(self.gamma - 1.0) > 0.05:
            bgr = cv2.LUT(bgr, self.gamma_lut)
        return bgr

    def toggle_enhancement(self) -> bool:
        self.enable_clahe = not self.enable_clahe
        if self.enable_clahe and self.clahe is None:
            self.clahe = cv2.createCLAHE(clipLimit=self.clahe_clip, tileGridSize=(8, 8))
        return self.enable_clahe

    def release(self):
        self._stop_bg_thread.set()
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_connected = False


class CameraHealthMonitor:
    """
    Evaluates real-time camera signal health (0-100%) and manages failover timing.
    
    Principles:
    - Zero detections ONLY penalizes health when brightness or blur metrics also look abnormal.
      An empty corridor in normal lighting and sharpness is 100% healthy.
    - True Failover Latency is strictly measured from the timestamp of the first bad frame
      (t_first_bad) to handover, guaranteeing latency >= debounce without false claims.
    - Configurable anti-flap hysteresis requires sustained healthy frames before returning to primary.
    """
    def __init__(
        self,
        min_brightness: float = 20.0,
        max_brightness: float = 245.0,
        min_laplacian_var: float = 35.0,
        max_interframe_gap_sec: float = 1.0,
        failover_threshold: float = 50.0,
        failover_debounce_sec: float = 1.5,
        recovery_hysteresis_sec: float = 5.0
    ):
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.min_laplacian_var = min_laplacian_var
        self.max_interframe_gap_sec = max_interframe_gap_sec
        self.failover_threshold = failover_threshold
        self.failover_debounce_sec = failover_debounce_sec
        self.recovery_hysteresis_sec = recovery_hysteresis_sec

        self.last_frame_time = time.time()
        self.first_bad_frame_time: Optional[float] = None
        self.first_healthy_frame_time: Optional[float] = None
        self.is_in_failover: bool = False
        self.current_score: float = 100.0

    def evaluate(self, frame: Optional[np.ndarray], detections_count: int, current_time: float) -> Tuple[float, bool, Optional[float], str]:
        """
        Returns:
            (health_score, is_in_failover, just_triggered_latency_seconds, reason_msg)
        """
        # 1. Total frame acquisition failure / disconnect
        if frame is None or frame.size == 0:
            score = 0.0
            reasons = ["FRAME_NONE_OR_DISCONNECTED"]
            is_abnormal_signal = True
        else:
            reasons = []
            score = 100.0

            # Inter-frame gap / freeze check
            dt = current_time - self.last_frame_time
            if dt > self.max_interframe_gap_sec:
                gap_penalty = min(60.0, (dt / self.max_interframe_gap_sec) * 35.0)
                score -= gap_penalty
                reasons.append(f"INTERFRAME_GAP_{dt:.2f}S")

            # Mean Brightness (Blackout vs Glare)
            mean_b = float(np.mean(frame))
            has_brightness_anomaly = False
            if mean_b < self.min_brightness:
                score -= 50.0
                has_brightness_anomaly = True
                reasons.append(f"UNDEREXPOSED_OR_OCCLUDED_{mean_b:.1f}")
            elif mean_b > self.max_brightness:
                score -= 45.0
                has_brightness_anomaly = True
                reasons.append(f"GLARE_OR_SATURATION_{mean_b:.1f}")

            # Sharpness / Blur / Dust / Fog (Laplacian variance)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            has_blur_anomaly = False
            if lap_var < self.min_laplacian_var:
                score -= 45.0
                has_blur_anomaly = True
                reasons.append(f"BLUR_OR_DUST_VAR_{lap_var:.1f}")

            is_abnormal_signal = has_brightness_anomaly or has_blur_anomaly

            # Zero Detections Rule: Only penalize if optical signal itself is abnormal!
            # An empty corridor with crisp focus and normal illumination is 100% HEALTHY.
            if detections_count == 0 and is_abnormal_signal:
                score -= 15.0
                reasons.append("ZERO_DETECTIONS_WITH_ABNORMAL_SIGNAL")

        self.last_frame_time = current_time
        score = float(np.clip(score, 0.0, 100.0))
        self.current_score = score

        just_triggered_latency = None
        reason_summary = " | ".join(reasons) if reasons else "SIGNAL_HEALTHY"

        # 2. Debounce and Measured Failover Timing Logic
        if score < self.failover_threshold:
            self.first_healthy_frame_time = None
            if self.first_bad_frame_time is None:
                self.first_bad_frame_time = current_time

            bad_duration = current_time - self.first_bad_frame_time

            if bad_duration >= self.failover_debounce_sec and not self.is_in_failover:
                self.is_in_failover = True
                just_triggered_latency = bad_duration
                print(
                    f"\n[FAILOVER-TRIGGER] Camera health collapsed to {score:.1f}% ({reason_summary}). "
                    f"Measured Failover Latency from first bad frame: {bad_duration:.2f}s."
                )
        else:
            # Good health
            self.first_bad_frame_time = None
            if self.is_in_failover:
                if self.first_healthy_frame_time is None:
                    self.first_healthy_frame_time = current_time
                healthy_duration = current_time - self.first_healthy_frame_time

                if healthy_duration >= self.recovery_hysteresis_sec:
                    self.is_in_failover = False
                    self.first_healthy_frame_time = None
                    print(
                        f"\n[FAILOVER-RECOVERY] Camera verified healthy ({score:.1f}%) continuously for "
                        f"{healthy_duration:.1f}s. Returning to Primary Edge AI Vision."
                    )

        return score, self.is_in_failover, just_triggered_latency, reason_summary

