"""
CPR AI Vision System - Metric Floor Homography & Ground Geometry
Maps image-space pedestrian foot coordinates to real-world metric corridor dimensions (m and people/m²).

Mathematical Principle:
- 4 perspective corner points marked on the corridor floor define a planar homography H.
- Any person's ground contact foot-point (bottom center of bounding box) is mapped:
    p_ground = H * p_image
- True physical density is computed directly:
    Density (people/m²) = Count(people inside ground boundary) / Area(m²)
- If video footage lacks known calibration dimensions, the class flags is_calibrated = False
  and labels density as 'Relative Density (norm)'.
"""
import cv2
import numpy as np
from typing import List, Tuple, Dict, Optional, Any

class HomographyZoneManager:
    def __init__(
        self,
        zone_id: str,
        calibration_corners_ratio: List[Tuple[float, float]],
        ground_width_m: float = 2.0,
        ground_length_m: float = 3.0,
        frame_w: int = 640,
        frame_h: int = 480,
        is_calibrated: bool = True
    ):
        self.zone_id = zone_id
        self.corners_ratio = calibration_corners_ratio
        self.ground_width_m = max(0.2, ground_width_m)
        self.ground_length_m = max(0.2, ground_length_m)
        self.ground_area_m2 = self.ground_width_m * self.ground_length_m
        self.frame_w = frame_w
        self.frame_h = frame_h
        self.is_calibrated = is_calibrated

        self.src_pts = np.zeros((4, 2), dtype=np.float32)
        self.dst_pts = np.float32([
            [0.0, 0.0],
            [self.ground_width_m, 0.0],
            [self.ground_width_m, self.ground_length_m],
            [0.0, self.ground_length_m]
        ])

        self.H: Optional[np.ndarray] = None
        self.H_inv: Optional[np.ndarray] = None
        self.polygon_pts: np.ndarray = np.zeros((4, 2), dtype=np.int32)

        self._recompute_homography()

    def update_resolution(self, frame_w: int, frame_h: int):
        self.frame_w = frame_w
        self.frame_h = frame_h
        self._recompute_homography()

    def _recompute_homography(self):
        pts = []
        for rx, ry in self.corners_ratio:
            pts.append([float(rx * self.frame_w), float(ry * self.frame_h)])
        self.src_pts = np.float32(pts)
        self.polygon_pts = np.int32(self.src_pts)

        try:
            self.H = cv2.getPerspectiveTransform(self.src_pts, self.dst_pts)
            self.H_inv = np.linalg.inv(self.H)
        except Exception as e:
            print(f"[HomographyZone] Warning: Failed to compute homography matrix: {e}")
            self.H = None
            self.H_inv = None

    def map_foot_to_ground(self, foot_pixel_pt: Tuple[float, float]) -> Optional[Tuple[float, float]]:
        """Maps a pixel coordinate (cx, bottom_y) to metric ground coordinate (xm, ym)."""
        if self.H is None:
            return None
        pt_in = np.array([[[foot_pixel_pt[0], foot_pixel_pt[1]]]], dtype=np.float32)
        pt_out = cv2.perspectiveTransform(pt_in, self.H)
        xm, ym = float(pt_out[0][0][0]), float(pt_out[0][0][1])
        return (xm, ym)

    def is_inside_ground_zone(self, foot_pixel_pt: Tuple[float, float]) -> bool:
        """Checks if foot point maps inside the metric ground bounds [0, width_m] x [0, length_m]."""
        # Fast polygon test first
        in_poly = cv2.pointPolygonTest(self.polygon_pts, (float(foot_pixel_pt[0]), float(foot_pixel_pt[1])), False) >= 0
        if not in_poly:
            return False

        if not self.is_calibrated or self.H is None:
            return True

        ground_pt = self.map_foot_to_ground(foot_pixel_pt)
        if ground_pt is None:
            return in_poly
        xm, ym = ground_pt
        # Margin tolerance of 5 cm
        return (-0.05 <= xm <= self.ground_width_m + 0.05) and (-0.05 <= ym <= self.ground_length_m + 0.05)

    def filter_occupancy(self, detection_boxes: List[Any], tracks: Dict[int, Any]) -> Tuple[List[int], Dict[int, Tuple[float, float]]]:
        """
        Takes detection boxes/tracks and filters people whose foot points are inside the corridor zone.
        Returns:
            (inside_track_ids, ground_positions_dict)
        """
        inside_ids = []
        ground_positions = {}

        for item in detection_boxes:
            # Handles raw box tuple (x1, y1, x2, y2, conf, track_id, (cx, cy))
            if isinstance(item, (tuple, list)) and len(item) >= 7:
                x1, y1, x2, y2, conf, tid, (cx, cy) = item[:7]
            else:
                continue

            # Bottom center is human ground contact point
            foot_pt = (float((x1 + x2) / 2.0), float(y2))

            if self.is_inside_ground_zone(foot_pt):
                if tid is not None:
                    inside_ids.append(tid)
                    gm = self.map_foot_to_ground(foot_pt)
                    if gm is not None:
                        ground_positions[tid] = gm

        return inside_ids, ground_positions

    def draw(self, frame: np.ndarray, color: Tuple[int, int, int] = (20, 206, 244), alpha: float = 0.15):
        """Draws shaded perspective ground corridor with dimension markings."""
        overlay = frame.copy()
        cv2.fillPoly(overlay, [self.polygon_pts], color)
        cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)
        cv2.polylines(frame, [self.polygon_pts], True, color, 2, cv2.LINE_AA)

        # Draw corner markers
        for pt in self.polygon_pts:
            cv2.circle(frame, (int(pt[0]), int(pt[1])), 4, (248, 247, 245), -1)

        # Dimension / Status Badge
        top_left = self.polygon_pts[0]
        if self.is_calibrated:
            label = f"ZONE: {self.ground_width_m:.1f}m x {self.ground_length_m:.1f}m ({self.ground_area_m2:.1f} m²)"
        else:
            label = "ZONE: UNCALIBRATED (Relative Flow)"

        cv2.putText(
            frame,
            label,
            (max(10, top_left[0] - 20), max(20, top_left[1] - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            color,
            1,
            cv2.LINE_AA
        )


# Backward-compatible alias
ZoneManager = HomographyZoneManager
