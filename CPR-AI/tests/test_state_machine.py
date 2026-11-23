"""
Unit Tests for Crowd Pressure Radar (CPR) State Machine & Failover
Testing:
1. GREEN -> AMBER -> RED transitions under Fruin Walkway LoS and Compressive Crush Hazard
2. Schmitt-trigger hysteresis and anti-flapping bands
3. Camera health monitor:
   - Empty corridor (0 detections, clean optical signal) remains 100% HEALTHY
   - Abnormal signal + 0 detections triggers penalty
   - Measured failover latency from exact first bad frame
   - 5.0s return-to-primary recovery hysteresis
4. Degraded mode baseline & stall logic:
   - Baseline updates frozen during non-GREEN states
   - Fixed fallback baseline before warmup
   - Absolute minimum throughput floor (< 2.0 PPM) triggers stall
5. Gate safety separation:
   - Hub heartbeat loss does NOT open gate (ESP32 autonomous metering persists)
   - Fail-open triggers: WDT reset, sensor bus fault, manual E-stop
"""

import unittest
import numpy as np
import time
from typing import Dict, Any

from config import cfg
from analytics.congestion import CongestionEstimator
from vision.camera import CameraHealthMonitor


class MockTrack:
    def __init__(self, track_id: int, speed: float = 60.0, is_stationary: bool = False, dwell: float = 1.0):
        self.track_id = track_id
        self.speed_px_per_sec = speed
        self.is_stationary = is_stationary
        self.total_dwell_seconds = dwell


class TestFruinCongestionEstimator(unittest.TestCase):
    def setUp(self):
        # 6.0 m² corridor area (2.0m x 3.0m)
        self.estimator = CongestionEstimator(
            ground_area_m2=6.0,
            is_calibrated=True,
            fruin_amber_density=0.72,
            fruin_elevated_density=1.08,
            crush_hazard_density=3.50,
            density_alpha=0.03,
            hysteresis_band=0.15,
            normal_speed_px=60.0
        )

    def test_green_free_flow(self):
        """1-2 persons in 6 m² (< 0.4 p/m²) with normal speed should remain GREEN."""
        tracks = {1: MockTrack(1, speed=65.0), 2: MockTrack(2, speed=58.0)}
        for _ in range(30):
            res = self.estimator.evaluate(tracks, [1, 2])
        self.assertEqual(res["state"], "GREEN")
        self.assertLess(res["density"], 0.72)

    def test_amber_transition_fruin_los(self):
        """Density reaching Fruin LoS D/E (>= 1.08 p/m²) triggers AMBER."""
        # 8 persons in 6 m² = 1.33 p/m² > 1.08 p/m²
        tracks = {i: MockTrack(i, speed=25.0) for i in range(1, 9)}
        res = None
        for _ in range(120):  # Smooth EMA convergence
            res = self.estimator.evaluate(tracks, list(tracks.keys()))
        self.assertEqual(res["state"], "AMBER")
        self.assertIn("FRUIN_LOS_RESTRICTED_FLOW", res["alerts"])

    def test_red_transition_compressive_crush_hazard(self):
        """Density reaching compressive hazard scale (>= 3.50 p/m²) triggers RED."""
        # 24 persons in 6 m² = 4.0 p/m² > 3.50 p/m²
        tracks = {i: MockTrack(i, speed=5.0, is_stationary=True) for i in range(1, 25)}
        res = None
        for _ in range(150):
            res = self.estimator.evaluate(tracks, list(tracks.keys()))
        self.assertEqual(res["state"], "RED")
        self.assertTrue(any("CRUSH" in a or "CRITICAL" in a for a in res["alerts"]))

    def test_schmitt_trigger_hysteresis_anti_flapping(self):
        """State does not drop back to GREEN until density falls below threshold minus hysteresis band."""
        # First escalate to AMBER
        tracks_dense = {i: MockTrack(i, speed=20.0) for i in range(1, 8)}
        for _ in range(120):
            self.estimator.evaluate(tracks_dense, list(tracks_dense.keys()))
        self.assertEqual(self.estimator.current_state, "AMBER")

        # Now reduce load to 0.65 p/m² (between 0.72 - 0.15 = 0.57 and 0.72)
        # 4 persons in 6 m² = 0.67 p/m².
        # Because 0.67 >= (0.72 - 0.15 = 0.57), it MUST STAY IN AMBER!
        tracks_border = {i: MockTrack(i, speed=50.0) for i in range(1, 5)}
        for _ in range(60):
            res = self.estimator.evaluate(tracks_border, list(tracks_border.keys()))
        self.assertEqual(res["state"], "AMBER", "Schmitt-trigger hysteresis should prevent drop to GREEN")

        # Now clear out corridor: 1 person in 6 m² = 0.17 p/m² < 0.57 p/m²
        tracks_clear = {1: MockTrack(1, speed=60.0)}
        for _ in range(150):
            res = self.estimator.evaluate(tracks_clear, [1])
        self.assertEqual(res["state"], "GREEN", "Should de-escalate to GREEN once well below hysteresis band")


class TestCameraHealthAndFailover(unittest.TestCase):
    def setUp(self):
        self.monitor = CameraHealthMonitor(
            min_brightness=20.0,
            max_brightness=245.0,
            min_laplacian_var=35.0,
            max_interframe_gap_sec=1.0,
            failover_threshold=50.0,
            failover_debounce_sec=1.5,
            recovery_hysteresis_sec=5.0
        )

    def _create_clean_frame(self):
        # Frame with textures (high laplacian variance) and normal brightness
        img = np.zeros((240, 320, 3), dtype=np.uint8)
        img[::10, :] = 120
        img[:, ::10] = 180
        return img

    def _create_blackout_frame(self):
        return np.zeros((240, 320, 3), dtype=np.uint8)

    def test_empty_corridor_zero_detections_remains_healthy(self):
        """Zero detections in an empty, well-lit, crisp corridor must NOT trigger health penalty."""
        clean_frame = self._create_clean_frame()
        t = 1000.0
        score, is_failover, latency, reason = self.monitor.evaluate(clean_frame, detections_count=0, current_time=t)
        self.assertEqual(score, 100.0)
        self.assertFalse(is_failover)
        self.assertEqual(reason, "SIGNAL_HEALTHY")

    def test_abnormal_signal_with_zero_detections_penalized(self):
        """Blackout/lens occlusion with zero detections must trigger health degradation."""
        blackout_frame = self._create_blackout_frame()
        t = 1000.0
        score, is_failover, latency, reason = self.monitor.evaluate(blackout_frame, detections_count=0, current_time=t)
        self.assertLess(score, 50.0)
        self.assertIn("UNDEREXPOSED", reason)

    def test_failover_latency_measured_from_first_bad_frame(self):
        """Failover latency must be measured strictly from T_first_bad to T_swapped (>= debounce)."""
        blackout = self._create_blackout_frame()
        start_t = 1000.0

        # Frame 1: First bad frame detected
        score, is_failover, latency, _ = self.monitor.evaluate(blackout, 0, current_time=start_t)
        self.assertFalse(is_failover, "Should not fail over on first frame (debounce required)")
        self.assertIsNone(latency)

        # Frame 2: 1.0s elapsed (debounce is 1.5s)
        score, is_failover, latency, _ = self.monitor.evaluate(blackout, 0, current_time=start_t + 1.0)
        self.assertFalse(is_failover, "Should not fail over before debounce window")

        # Frame 3: 1.6s elapsed (exceeds 1.5s debounce)
        score, is_failover, latency, _ = self.monitor.evaluate(blackout, 0, current_time=start_t + 1.6)
        self.assertTrue(is_failover, "Failover should trigger after debounce window")
        self.assertIsNotNone(latency)
        # Exact measured latency must match start_t to current_time
        self.assertAlmostEqual(latency, 1.6, places=2)

    def test_return_to_primary_recovery_hysteresis(self):
        """Primary AI vision must only be restored after 5.0 continuous seconds of healthy frames."""
        blackout = self._create_blackout_frame()
        clean = self._create_clean_frame()
        t = 1000.0

        # Trigger failover
        self.monitor.evaluate(blackout, 0, t)
        self.monitor.evaluate(blackout, 0, t + 1.6)
        self.assertTrue(self.monitor.is_in_failover)

        # Restore healthy frames starting at t = 1002.0 at 10 FPS (0.1s intervals)
        curr = t + 2.0
        # Feed 3.0s of healthy frames (curr goes up to 1005.0)
        for _ in range(30):
            curr += 0.1
            score, is_failover, _, _ = self.monitor.evaluate(clean, 2, curr)
        self.assertTrue(is_failover, "System must remain in failover until full 5.0s continuous healthy window")

        # Feed another 2.5s of healthy frames (curr passes 5.0s recovery threshold)
        for _ in range(25):
            curr += 0.1
            score, is_failover, _, _ = self.monitor.evaluate(clean, 2, curr)
        self.assertFalse(is_failover, "System must return to primary AI after 5.0s continuous healthy frames")


class DegradedModeController:
    """Python simulation of the LD2410C + ToF + IR fallback logic."""
    def __init__(self):
        self.baseline_ppm = cfg.baseline_initial_throughput_ppm # 20.0
        self.is_warmed_up = False
        self.current_state = "GREEN"
        self.total_seconds = 0.0

    def update(self, current_ppm: float, dwell_seconds: float, dt: float = 1.0) -> str:
        self.total_seconds += dt
        if self.total_seconds >= cfg.baseline_warmup_seconds:
            self.is_warmed_up = True

        # Determine target state first
        # Rule 2: Near-zero throughput is ALWAYS a stall regardless of baseline
        new_state = "GREEN"
        if current_ppm < cfg.absolute_min_throughput_ppm and dwell_seconds >= cfg.degraded_amber_dwell_seconds:
            new_state = "RED" if dwell_seconds >= cfg.degraded_red_dwell_seconds else "AMBER"
        else:
            ratio = current_ppm / max(1.0, self.baseline_ppm)
            if ratio <= cfg.degraded_red_throughput_ratio or dwell_seconds >= cfg.degraded_red_dwell_seconds:
                new_state = "RED"
            elif ratio <= cfg.degraded_amber_throughput_ratio or dwell_seconds >= cfg.degraded_amber_dwell_seconds:
                new_state = "AMBER"
            else:
                new_state = "GREEN"

        # Rule 2: Freeze baseline updates whenever state is not GREEN
        if self.current_state == "GREEN" and new_state == "GREEN":
            alpha = cfg.baseline_ema_alpha
            self.baseline_ppm = (alpha * current_ppm) + ((1.0 - alpha) * self.baseline_ppm)

        self.current_state = new_state
        return self.current_state


class TestDegradedModeAndBaseline(unittest.TestCase):
    def test_absolute_minimum_stall_detection(self):
        """Throughput < 2.0 PPM with dwell >= 3.5s triggers stall even if baseline is low."""
        ctrl = DegradedModeController()
        # Normal initial baseline is 20 PPM
        state = ctrl.update(current_ppm=1.0, dwell_seconds=4.0)
        self.assertEqual(state, "AMBER")

        state = ctrl.update(current_ppm=0.5, dwell_seconds=7.0)
        self.assertEqual(state, "RED")

    def test_baseline_frozen_during_non_green(self):
        """Rolling baseline throughput must NOT update while in AMBER or RED state."""
        ctrl = DegradedModeController()
        initial_baseline = ctrl.baseline_ppm

        # Trigger AMBER
        ctrl.update(current_ppm=1.0, dwell_seconds=4.0)
        self.assertEqual(ctrl.current_state, "AMBER")

        # Feed degraded data for 10 steps
        for _ in range(10):
            ctrl.update(current_ppm=0.5, dwell_seconds=4.0)
            self.assertEqual(ctrl.baseline_ppm, initial_baseline, "Baseline must remain frozen during AMBER")


class MockESP32GateSafetyController:
    """Simulation of firmware fail-open vs autonomous hub loss logic."""
    def __init__(self):
        self.gate_open = True
        self.hub_connected = True
        self.sensor_ok = True
        self.e_stop_active = False
        self.wdt_panic = False
        self.local_state = "GREEN"

    def evaluate_gate(self) -> bool:
        # FAIL-OPEN PATHS:
        # 1. Hardware WDT or Panic
        if self.wdt_panic:
            self.gate_open = True
            return self.gate_open

        # 2. Local sensor hardware failure
        if not self.sensor_ok:
            self.gate_open = True
            return self.gate_open

        # 3. Manual E-Stop triggered
        if self.e_stop_active:
            self.gate_open = True
            return self.gate_open

        # HUB CONNECTION LOSS:
        # Must NOT open gate! ESP32 continues autonomous local metering.
        # If local_state is RED, gate remains CLOSED.
        if not self.hub_connected:
            # Autonomous metering applies:
            if self.local_state == "RED":
                self.gate_open = False
            elif self.local_state == "AMBER":
                self.gate_open = False # metered
            else:
                self.gate_open = True
            return self.gate_open

        # Normal operation:
        if self.local_state == "RED":
            self.gate_open = False
        else:
            self.gate_open = True
        return self.gate_open


class TestGateSafetyAndHubLoss(unittest.TestCase):
    def setUp(self):
        self.gate = MockESP32GateSafetyController()

    def test_hub_loss_does_not_open_gate(self):
        """Wi-Fi / Hub loss must NOT defeat metering or open a RED gate."""
        self.gate.local_state = "RED"
        self.gate.evaluate_gate()
        self.assertFalse(self.gate.gate_open, "Gate should be closed during RED")

        # Disconnect Hub / Wi-Fi
        self.gate.hub_connected = False
        is_open = self.gate.evaluate_gate()
        self.assertFalse(is_open, "Hub loss must NOT open the gate; local autonomous metering must persist!")

    def test_wdt_panic_fails_open(self):
        """WDT panic must immediately fail open."""
        self.gate.local_state = "RED"
        self.gate.wdt_panic = True
        is_open = self.gate.evaluate_gate()
        self.assertTrue(is_open, "WDT panic must fail open for life safety")

    def test_sensor_failure_fails_open(self):
        """Sensor failure must immediately fail open."""
        self.gate.local_state = "RED"
        self.gate.sensor_ok = False
        is_open = self.gate.evaluate_gate()
        self.assertTrue(is_open, "Sensor failure must fail open")

    def test_manual_estop_fails_open(self):
        """Manual E-stop must immediately fail open."""
        self.gate.local_state = "RED"
        self.gate.e_stop_active = True
        is_open = self.gate.evaluate_gate()
        self.assertTrue(is_open, "Manual E-Stop must fail open")


if __name__ == "__main__":
    unittest.main()
