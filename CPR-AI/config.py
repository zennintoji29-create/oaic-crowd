"""
CPR AI Vision System - Global Production Configuration
Crowd Pressure Radar (CPR) - Odisha AI Hackathon 2026

THEORETICAL CITATIONS & FORMULA GROUNDING:
1. Walkway Level of Service (LoS):
   John J. Fruin, "Pedestrian Planning and Design", Metropolitan Association of
   Urban Designers and Environmental Planners (MAUDEP), 1971.
   Transportation Research Board (TRB), "Highway Capacity Manual" (HCM 2010),
   Chapter 23: Off-Street Pedestrian Facilities.
   - LoS A: > 3.24 m²/p (< 0.31 p/m²) - Free pedestrian flow
   - LoS B: 2.32 to 3.24 m²/p (0.31 to 0.43 p/m²) - Flow fluid, conflicts rare
   - LoS C: 1.39 to 2.32 m²/p (0.43 to 0.72 p/m²) - Normal walking speeds
   - LoS D: 0.93 to 1.39 m²/p (0.72 to 1.08 p/m²) - Speeds restricted, bypasses difficult
   - LoS E: 0.46 to 0.93 m²/p (1.08 to 2.17 p/m²) - Maximum capacity, shuffling
   - LoS F: < 0.46 m²/p (> 2.17 p/m²) - Breakdown of walking flow

2. Crowd Crush & Compressive Mechanics:
   G. Keith Still, "Introduction to Crowd Science", CRC Press, 2014.
   Dirk Helbing, Anders Johansson, Habib Zein Al-Abideen, "Dynamics of crowd disasters:
   An empirical study", Physical Review E 75(4), 046109, 2007.
   - Walkway LoS F (2.17 p/m²) is slow congested walking, NOT mechanical crush hazard.
   - Compressive crowd crush forces begin at 4.0 to 5.0+ p/m² with flow collapse.
   - CPR uses two distinct scales:
       * Walkway LoS (LoS D/E, 0.72 - 1.08 p/m²) for GREEN -> AMBER warning.
       * Compressive Hazard Scale (>= 3.50 p/m² or stall with high density) for RED.
"""
from dataclasses import dataclass, field
from typing import Tuple, List
import os

@dataclass
class VisionConfig:
    # -------------------------------------------------------------
    # 1. Camera & Video Source Settings
    # -------------------------------------------------------------
    # source: "auto" (detects USB or built-in camera across OS),
    # integer index (0, 1), IP stream URL, or path to video file.
    camera_source: str = os.getenv("CPR_CAMERA_SOURCE", "auto")
    prefer_external_camera: bool = os.getenv("CPR_PREFER_EXTERNAL_CAMERA", "true").lower() in ("true", "1", "yes")
    frame_width: int = 640
    frame_height: int = 480
    target_fps: int = 30
    auto_reconnect_delay: float = 2.0
    
    # Low-Light & Image Preprocessing
    enable_clahe: bool = True
    clahe_clip_limit: float = 2.2
    gamma_correction: float = 1.15

    # -------------------------------------------------------------
    # 2. YOLO & ByteTrack Detector Settings
    # -------------------------------------------------------------
    model_name: str = os.getenv("CPR_YOLO_MODEL", "yolo11n.pt")
    confidence_threshold: float = 0.40
    iou_threshold: float = 0.45
    target_class_id: int = 0  # 0 = person in COCO
    tracker_config: str = "bytetrack.yaml"

    # -------------------------------------------------------------
    # 3. Virtual Counting Line Geometry (Relative ratios: 0.0 - 1.0)
    # -------------------------------------------------------------
    line_start_ratio: Tuple[float, float] = (0.05, 0.55)
    line_end_ratio: Tuple[float, float] = (0.95, 0.55)
    line_debounce_seconds: float = 1.5

    # -------------------------------------------------------------
    # 4. Movement, Velocity Variance & Dwell Analytics
    # -------------------------------------------------------------
    speed_smoothing_window: int = 6
    stationary_speed_threshold_px: float = 25.0   # Pixels/sec in image space
    stationary_dwell_seconds: float = 3.0         # Threshold for individual stationary alert
    max_trajectory_history: int = 25

    # -------------------------------------------------------------
    # 5. Floor Homography & Ground Geometry (Metric Units)
    # -------------------------------------------------------------
    # True if the 4 calibration points correspond to known metric ground plane
    is_calibrated_geometry: bool = True
    # Real-world corridor zone dimensions in meters
    # Default: 2.0m width x 3.0m length = 6.0 m² for real tests (or 1.5m x 2.0m = 3.0 m² for bench demos)
    ground_width_m: float = float(os.getenv("CPR_GROUND_WIDTH_M", "2.0"))
    ground_length_m: float = float(os.getenv("CPR_GROUND_LENGTH_M", "3.0"))
    
    # 4 perspective ground plane corners [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
    # Ratios normalized to frame width/height
    zone_calibration_corners: List[Tuple[float, float]] = field(default_factory=lambda: [
        (0.15, 0.20),  # Far left (top of corridor)
        (0.85, 0.20),  # Far right (top of corridor)
        (0.95, 0.88),  # Near right (bottom of corridor)
        (0.05, 0.88)   # Near left (bottom of corridor)
    ])

    @property
    def ground_area_m2(self) -> float:
        return max(0.1, self.ground_width_m * self.ground_length_m)

    # -------------------------------------------------------------
    # 6. Fruin Walkway LoS & Compressive Hazard Thresholds
    # -------------------------------------------------------------
    # Flow service thresholds (Walkway LoS A-E) governing AMBER warning
    fruin_los_c_density: float = 0.72   # p/m² (LoS C/D boundary: flow becomes restricted)
    fruin_los_d_density: float = 1.08   # p/m² (LoS D/E boundary: severe shuffling)
    
    # Compressive crowd crush hazard scale governing RED alarm
    crush_hazard_density: float = 3.50  # p/m² (onset of involuntary compressive contact)
    crush_critical_density: float = 4.50 # p/m² (severe life-safety physical crush hazard)
    
    # Speed & Turbulence thresholds
    amber_speed_drop_ratio: float = 0.50 # Velocity dropped below 50% of brisk walk
    amber_speed_variance_min: float = 0.25 # Stop-and-go speed variance indicator
    red_stall_speed_mps: float = 0.15   # Nearly stationary walking speed

    # Density exponential smoothing & Schmitt-trigger hysteresis
    density_smoothing_alpha: float = 0.03 # Smooth per-frame alpha (~1s half-life at 30 FPS)
    density_hysteresis_band: float = 0.15 # p/m² gap required to drop down a state

    # -------------------------------------------------------------
    # 7. Camera Health & Autonomous Failover Timing
    # -------------------------------------------------------------
    cam_health_min_brightness: float = 20.0
    cam_health_max_brightness: float = 245.0
    cam_health_min_laplacian_var: float = 35.0  # Blur, dust, or lens cover detection
    cam_health_max_interframe_gap: float = 1.0  # Seconds before flagging stream freeze
    cam_health_failover_threshold: float = 50.0 # Score < 50% triggers failover
    
    failover_debounce_seconds: float = 1.5      # Time health must stay degraded before failover
    return_to_primary_seconds: float = 5.0      # Continuous healthy time required to return to primary

    # -------------------------------------------------------------
    # 8. Degraded Mode & Rolling Baseline (LD2410C + ToF + IR)
    # -------------------------------------------------------------
    # Degraded mode operates on a single-file corridor gate (60-90 cm aperture)
    baseline_warmup_seconds: float = 60.0
    baseline_initial_throughput_ppm: float = 20.0 # Fallback baseline (people/min) before warmup
    baseline_ema_alpha: float = 0.05              # Rolling baseline smoothing (only updated when GREEN)
    absolute_min_throughput_ppm: float = 2.0      # Below 2 PPM is ALWAYS considered a stall
    
    degraded_amber_throughput_ratio: float = 0.40 # Drop below 40% of baseline -> AMBER
    degraded_red_throughput_ratio: float = 0.15   # Drop below 15% of baseline -> RED
    degraded_amber_dwell_seconds: float = 3.5     # Stationary dwell time for AMBER
    degraded_red_dwell_seconds: float = 6.0       # Stationary dwell time for RED

    # -------------------------------------------------------------
    # 9. Backend Integration & Telemetry Pipeline
    # -------------------------------------------------------------
    backend_url: str = os.getenv("CPR_BACKEND_URL", "http://localhost:5050/api/telemetry")
    auth_token: str = os.getenv("CPR_AUTH_TOKEN", "cpr-secret-key-2026")
    device_id: str = "cpr-vision-gate-01"
    zone_id: str = "zone-corridor-a"
    telemetry_rate_hz: float = 2.0
    firmware_version: str = "cpr-ai-v2.5-fruin"

    # -------------------------------------------------------------
    # 10. Visual Palette (BGR matching Color Hunt #45474B, #495E57, #F4CE14, #F5F7F8)
    # -------------------------------------------------------------
    COLOR_GOLD: Tuple[int, int, int] = (20, 206, 244)        # #F4CE14 in BGR
    COLOR_SAGE: Tuple[int, int, int] = (87, 94, 73)          # #495E57 in BGR
    COLOR_CHARCOAL: Tuple[int, int, int] = (75, 71, 69)      # #45474B in BGR
    COLOR_WHITE: Tuple[int, int, int] = (248, 247, 245)      # #F5F7F8 in BGR
    COLOR_RED: Tuple[int, int, int] = (40, 40, 235)

cfg = VisionConfig()
