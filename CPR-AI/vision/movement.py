"""
CPR AI Vision System - Movement, Trajectory, and Dwell-Time Engine
Tracks person velocities, movement vectors, dwell times, and stationary stopping behaviour.
"""
import time
from collections import deque
from typing import Dict, Tuple, Optional
import numpy as np

class PersonTrackState:
    def __init__(self, track_id: int, initial_pos: Tuple[int, int], timestamp: float):
        self.track_id = track_id
        self.first_seen = timestamp
        self.last_seen = timestamp
        
        # Position history: deque of (x, y, timestamp)
        self.positions = deque(maxlen=30)
        self.positions.append((*initial_pos, timestamp))

        self.speed_px_per_sec: float = 0.0
        self.is_stationary: bool = False
        self.stationary_start: Optional[float] = None
        self.total_dwell_seconds: float = 0.0
        self.direction_vector: Tuple[float, float] = (0.0, 0.0)

    def update(self, new_pos: Tuple[int, int], timestamp: float, stationary_speed_thresh: float = 25.0, stationary_dwell_thresh: float = 3.0):
        dt = timestamp - self.last_seen
        self.last_seen = timestamp
        self.total_dwell_seconds = timestamp - self.first_seen

        # Add new point
        self.positions.append((*new_pos, timestamp))

        # Calculate instantaneous speed across recent history
        if len(self.positions) >= 3:
            # Look back over ~5-10 frames for smoothing
            p_old = self.positions[0]
            p_new = self.positions[-1]
            elapsed = p_new[2] - p_old[2]
            
            if elapsed > 0.01:
                dx = p_new[0] - p_old[0]
                dy = p_new[1] - p_old[1]
                dist = np.hypot(dx, dy)
                self.speed_px_per_sec = dist / elapsed
                self.direction_vector = (dx / (dist + 1e-5), dy / (dist + 1e-5))

        # Stationary state evaluation
        if self.speed_px_per_sec < stationary_speed_thresh:
            if self.stationary_start is None:
                self.stationary_start = timestamp
            elif (timestamp - self.stationary_start) >= stationary_dwell_thresh:
                self.is_stationary = True
        else:
            self.stationary_start = None
            self.is_stationary = False


class MovementTracker:
    def __init__(
        self,
        stationary_speed_thresh: float = 25.0,
        stationary_dwell_thresh: float = 3.0,
        smoothing_window: int = 6
    ):
        self.tracks: Dict[int, PersonTrackState] = {}
        self.stationary_speed_thresh = stationary_speed_thresh
        self.stationary_dwell_thresh = stationary_dwell_thresh
        self.smoothing_window = smoothing_window

    def update_tracks(self, detections: Dict[int, Tuple[int, int]], current_time: float):
        """
        detections: Dict mapping track_id -> centroid (cx, cy)
        """
        active_ids = set(detections.keys())

        # 1. Update existing tracks and add new ones
        for track_id, centroid in detections.items():
            if track_id not in self.tracks:
                self.tracks[track_id] = PersonTrackState(track_id, centroid, current_time)
            else:
                self.tracks[track_id].update(
                    centroid, current_time, 
                    self.stationary_speed_thresh, 
                    self.stationary_dwell_thresh
                )

        # 2. Prune tracks that disappeared for more than 4 seconds
        stale_ids = [
            tid for tid, track in self.tracks.items()
            if tid not in active_ids and (current_time - track.last_seen) > 4.0
        ]
        for tid in stale_ids:
            del self.tracks[tid]

    def get_track(self, track_id: int) -> Optional[PersonTrackState]:
        return self.tracks.get(track_id)

    def get_stationary_count(self) -> int:
        return sum(1 for track in self.tracks.values() if track.is_stationary)
