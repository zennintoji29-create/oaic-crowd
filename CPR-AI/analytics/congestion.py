"""
CPR AI Vision System - Crowd Congestion & Operational Pressure Estimator
Fruin Level of Service (LoS) & Compressive Crush Hazard Engine

Theoretical Foundation:
1. Walkway Level of Service (John J. Fruin, 1971; HCM 2010 Chapter 23):
   - LoS C / D boundary: 0.72 p/m² (normal flow ends; speed restricts)
   - LoS D / E boundary: 1.08 p/m² (shuffling, queue compression)
   - LoS F: > 2.17 p/m² (breakdown of walking flow; queuing condition)
2. Compressive Crush Hazard (G. Keith Still 2014; Helbing et al. 2007):
   - Walkway LoS F (2.17 p/m²) is slow queue shuffling, NOT mechanical crush hazard.
   - Physical crowd crush forces emerge at 3.50 to 4.50+ p/m² when lateral movement ceases.
   - State machine operates two distinct scales:
       * Fruin Walkway LoS governs GREEN -> AMBER
       * Compressive Hazard Scale governs AMBER -> RED

Features:
- Low-pass Exponential Moving Average (EMA) density smoothing (alpha = 0.03 per frame)
  preventing boundary flicker.
- Dual Schmitt-trigger hysteresis bands (0.15 p/m²) preventing rapid state flapping.
- Velocity variance (sigma_v) and mean speed (mu_v) stop-and-go turbulence detection.
"""
from typing import Dict, List, Tuple, Any
import numpy as np

class CongestionEstimator:
    def __init__(
        self,
        ground_area_m2: float = 6.0,
        is_calibrated: bool = True,
        fruin_amber_density: float = 0.72,
        fruin_elevated_density: float = 1.08,
        crush_hazard_density: float = 3.50,
        density_alpha: float = 0.03,
        hysteresis_band: float = 0.15,
        normal_speed_px: float = 60.0
    ):
        self.ground_area_m2 = max(0.1, ground_area_m2)
        self.is_calibrated = is_calibrated
        self.fruin_amber_density = fruin_amber_density
        self.fruin_elevated_density = fruin_elevated_density
        self.crush_hazard_density = crush_hazard_density
        self.density_alpha = density_alpha
        self.hysteresis_band = hysteresis_band
        self.normal_speed_px = normal_speed_px

        # Smoothed state variables
        self.smoothed_density: float = 0.0
        self.current_state: str = "GREEN"

    def evaluate(self, active_tracks: Dict[int, Any], zone_ids: List[int]) -> Dict[str, Any]:
        """
        Evaluates crowd safety metrics for individuals inside the calibrated ground corridor.
        """
        zone_tracks = [active_tracks[tid] for tid in zone_ids if tid in active_tracks]
        raw_occupancy = len(zone_tracks)

        # 1. Compute raw and smoothed physical density
        if self.is_calibrated:
            raw_density = float(raw_occupancy / self.ground_area_m2)
        else:
            # Normalized relative load (0.0 to 1.0)
            raw_density = float(raw_occupancy / 6.0)

        # Exponential moving average filter (alpha = 0.03 per frame)
        if self.smoothed_density == 0.0 and raw_density > 0:
            self.smoothed_density = raw_density
        else:
            self.smoothed_density = (self.density_alpha * raw_density) + ((1.0 - self.density_alpha) * self.smoothed_density)

        smoothed_density_rounded = round(float(self.smoothed_density), 2)

        # 2. Velocity and Stop-and-Go Turbulence Analytics
        speeds = [getattr(t, "speed_px_per_sec", 0.0) for t in zone_tracks]
        if speeds:
            avg_speed = float(np.mean(speeds))
            speed_std_dev = float(np.std(speeds))
        else:
            avg_speed = 0.0
            speed_std_dev = 0.0

        stationary_count = sum(1 for t in zone_tracks if getattr(t, "is_stationary", False))
        stop_go_ratio = float(stationary_count / raw_occupancy) if raw_occupancy > 0 else 0.0

        # Turbulence metric: high velocity variance with low average speed indicates stop-and-go shockwaves
        speed_deceleration = max(0.0, 1.0 - min(1.0, avg_speed / max(1.0, self.normal_speed_px)))
        normalized_variance = min(1.0, speed_std_dev / max(1.0, self.normal_speed_px))
        turbulence_index = float(0.6 * stop_go_ratio + 0.4 * normalized_variance)

        # 3. Composite Crowd Pressure Score (0.0 to 1.0)
        # Scaled against crush hazard threshold
        density_hazard_ratio = min(1.0, self.smoothed_density / self.crush_hazard_density)
        composite_score = (0.55 * density_hazard_ratio) + (0.30 * turbulence_index) + (0.15 * speed_deceleration)
        composite_score = round(float(np.clip(composite_score, 0.0, 1.0)), 2)

        # 4. Two-Tier State Machine with Schmitt-Trigger Hysteresis
        # Tier 1 (Fruin LoS): GREEN -> AMBER
        # Tier 2 (Compressive Hazard): AMBER -> RED
        alerts = []
        prev_state = self.current_state

        if self.current_state == "GREEN":
            # Enter AMBER if density reaches Fruin LoS D with deceleration, or reaches LoS E directly
            if (self.smoothed_density >= self.fruin_amber_density and speed_deceleration >= 0.40) or \
               (self.smoothed_density >= self.fruin_elevated_density) or \
               (turbulence_index >= 0.50 and raw_occupancy >= 4):
                self.current_state = "AMBER"
                alerts.append("FRUIN_LOS_RESTRICTED_FLOW")
            elif self.smoothed_density >= self.crush_hazard_density:
                self.current_state = "RED"
                alerts.append("CRUSH_HAZARD_THRESHOLD_EXCEEDED")

        elif self.current_state == "AMBER":
            # Enter RED if compressive density exceeded OR severe stall with high density
            if self.smoothed_density >= self.crush_hazard_density or \
               (self.smoothed_density >= 2.17 and stop_go_ratio >= 0.75 and raw_occupancy >= 6):
                self.current_state = "RED"
                alerts.append("CRITICAL_COMPRESSIVE_STALL")
            # Drop back to GREEN with hysteresis margin
            elif self.smoothed_density < (self.fruin_amber_density - self.hysteresis_band) and \
                 turbulence_index < 0.25:
                self.current_state = "GREEN"
            else:
                alerts.append("FRUIN_LOS_RESTRICTED_FLOW")
                alerts.append("CONGESTION_ELEVATED")

        elif self.current_state == "RED":
            # Drop to AMBER only after density drops below crush threshold minus hysteresis
            if self.smoothed_density < (self.crush_hazard_density - self.hysteresis_band) and \
               stop_go_ratio < 0.50:
                self.current_state = "AMBER"
                alerts.append("RECOVERING_FROM_CRUSH_HAZARD")
            else:
                alerts.append("CRITICAL_CRUSH_HAZARD")

        if stationary_count >= 3:
            alerts.append("STATIONARY_CORRIDOR_BOTTLENECK")

        return {
            "state": self.current_state,
            "previous_state": prev_state,
            "score": composite_score,
            "density": smoothed_density_rounded,
            "density_raw": round(raw_density, 2),
            "density_unit": "people/m²" if self.is_calibrated else "Relative Density (norm)",
            "ground_area_m2": round(self.ground_area_m2, 2),
            "is_calibrated": self.is_calibrated,
            "occupancy": raw_occupancy,
            "avg_speed": round(avg_speed, 1),
            "speed_std_dev": round(speed_std_dev, 1),
            "stop_go_ratio": round(stop_go_ratio, 2),
            "turbulence_index": round(turbulence_index, 2),
            "stationary_count": stationary_count,
            "alerts": alerts
        }
