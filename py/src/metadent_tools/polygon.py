try:
    import cv2 as cv
except ImportError:
    raise ImportError("OpenCV is required for polygon operations. please install 'opencv-python' / 'opencv-python-headless'.")

from typing import Literal
import numpy as np
from .model import Polygon

def quantize_polygon(polygon: Polygon, qmax_wh: tuple[int, int] | int) -> np.ndarray[tuple[int, Literal[2]], np.dtype[np.int32]]:
    """Quantize polygon coordinates to int32, with the given maximum width and height."""
    if isinstance(qmax_wh, int):
        qmax_wh = (qmax_wh, qmax_wh)
    w, h = qmax_wh
    scale = np.array([w, h], dtype=np.float64)
    quantized = np.round(polygon * scale).astype(np.int32)
    return quantized    # type: ignore

def polygons_to_mask(polygons: list[Polygon], im_size_wh: tuple[int, int]) -> np.ndarray:
    """Convert polygons in normalized (x, y) coords to a binary 2D uint8 mask."""
    w, h = im_size_wh
    mask = np.zeros((h, w), dtype=np.uint8)
    if not polygons:
        return mask

    for polygon in polygons:
        pts = quantize_polygon(polygon, (w, h))
        cv.fillPoly(mask, [pts], color=255)
    return mask

def mask_to_polygons(mask: np.ndarray) -> list[Polygon]:
    """
    mask: (H, W) binary mask where 1 indicates the object and 0 indicates the background, 
        or (3, H, W), where the first channel is the binary mask.
    return a list of polygons, where each polygon is represented as a array of (x, y) coordinates [[(x1, y1), (x2, y2), ...], [...], ...]
    """

    def _as_binary_mask_2d(mask: np.ndarray) -> np.ndarray:
        """Return a 2D uint8 mask with values in {0, 255}."""
        if mask.ndim == 3:
            if mask.shape[0] != 3:
                raise ValueError("Mask must be either (H, W) or (3, H, W)")
            mask = mask[0]
        if mask.ndim != 2:
            raise ValueError("Mask must be either (H, W) or (3, H, W)")
        return (mask > 0).astype(np.uint8) * 255

    binary = _as_binary_mask_2d(mask)
    h, w = binary.shape

    contours, _ = cv.findContours(binary, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []

    denom = np.array([w, h], dtype=np.float64)
    polygons: list[Polygon] = []
    for contour in contours:
        pts = contour.squeeze(1)
        if pts.shape[0] < 3:
            continue
        polygons.append(np.asarray(pts, dtype=np.float64) / denom)  # type: ignore
    return polygons

def simplify_polygon(
    polygon: Polygon, 
    epsilon: float = 0.5,
    resolution: int = 512, 
    unify_orientation: bool = True, 
    unify_start_point: bool = True, 
    max_points: int | None = None,
    optimize_iou: bool = False,
    min_iou: float | None = None,
    ) -> Polygon:
    """Simplify a polygon with OpenCV's Ramer-Douglas-Peucker algorithm.
    - `epsilon` is the approximation tolerance in pixels (after quantization to `resolution`).
    - `unify_orientation` ensures that the polygon is oriented counter-clockwise.
    - `unify_start_point` ensures that the polygon starts from the point with the smallest (x+y) coordinate.
    - When ``max_points`` is set, use the smallest approximation tolerance that
      produces no more than that number of vertices. 
    - Set ``optimize_iou`` to locally adjust those vertices for better raster-mask IoU. 
    - With ``min_iou``, remove redundant vertices while retaining at least that IoU.
    """
    if max_points is not None and max_points < 3:
        raise ValueError("max_points must be at least 3")
    if min_iou is not None and not 0 <= min_iou <= 1:
        raise ValueError("min_iou must be between 0 and 1")
    if min_iou is not None and (max_points is None or not optimize_iou):
        raise ValueError("min_iou requires max_points and optimize_iou=True")
    if polygon.shape[0] < 3:
        return polygon
    pts = quantize_polygon(polygon, resolution)
    if unify_orientation and cv.isContourConvex(pts):
        if cv.contourArea(pts) < 0:
            pts = pts[::-1]
    if unify_start_point:
        start_idx = np.argmin(pts.sum(axis=1))  # Start from the point with the smallest (x+y)
        pts = np.roll(pts, -start_idx, axis=0)
    simplified = cv.approxPolyDP(pts, epsilon, closed=True)
    if max_points is not None and len(simplified) > max_points:
        upper_epsilon = max(epsilon, float(np.linalg.norm(np.ptp(pts, axis=0))))
        lower_epsilon = epsilon
        simplified = cv.approxPolyDP(pts, upper_epsilon, closed=True)
        for _ in range(24):
            candidate_epsilon = (lower_epsilon + upper_epsilon) / 2
            candidate = cv.approxPolyDP(pts, candidate_epsilon, closed=True)
            if len(candidate) <= max_points:
                upper_epsilon = candidate_epsilon
                simplified = candidate
            else:
                lower_epsilon = candidate_epsilon
    if optimize_iou and max_points is not None:
        max_step = max(1, resolution // 32)
        clipped_pts = np.clip(pts, 0, resolution - 1)
        min_xy = np.maximum(clipped_pts.min(axis=0) - max_step, 0)
        max_xy = np.minimum(clipped_pts.max(axis=0) + max_step, resolution - 1)
        roi_size = max_xy - min_xy + 1
        local_pts = clipped_pts - min_xy
        target_mask = np.zeros((int(roi_size[1]), int(roi_size[0])), dtype=np.uint8)
        cv.fillPoly(target_mask, [local_pts], color=255)
        candidate_mask = np.empty_like(target_mask)
        intersection_mask = np.empty_like(target_mask)
        target_area = cv.countNonZero(target_mask)

        def iou(candidate: np.ndarray) -> float:
            candidate_mask.fill(0)
            cv.fillPoly(candidate_mask, [candidate], color=255)
            candidate_area = cv.countNonZero(candidate_mask)
            intersection = cv.countNonZero(
                cv.bitwise_and(target_mask, candidate_mask, dst=intersection_mask)
            )
            union = target_area + candidate_area - intersection
            return intersection / union if union else 1.0

        def refine_iou(candidate: np.ndarray) -> tuple[np.ndarray, float]:
            refined = candidate.copy()
            best_iou = iou(refined)
            directions = ((1, 0), (-1, 0), (0, 1), (0, -1),
                          (1, 1), (1, -1), (-1, 1), (-1, -1))
            steps = dict.fromkeys((max_step, max(1, resolution // 128), 1))
            for step in steps:
                improved = True
                while improved:
                    improved = False
                    for point_index in range(len(refined)):
                        original_point = refined[point_index].copy()
                        for direction_x, direction_y in directions:
                            refined[point_index] = np.clip(
                                original_point + (direction_x * step, direction_y * step), 0, roi_size - 1
                            )
                            if np.array_equal(refined[point_index], original_point):
                                continue
                            if abs(cv.contourArea(refined)) < 1:
                                refined[point_index] = original_point
                                continue
                            candidate_iou = iou(refined)
                            if candidate_iou > best_iou:
                                best_iou = candidate_iou
                                improved = True
                                original_point = refined[point_index].copy()
                            else:
                                refined[point_index] = original_point
            return refined, best_iou

        initial = np.clip(simplified.squeeze(1), min_xy, max_xy) - min_xy
        refined, best_iou = refine_iou(initial)
        while min_iou is not None and len(refined) > 3:
            removals = [np.delete(refined, point_index, axis=0) for point_index in range(len(refined))]
            best_removal = max(removals, key=iou)
            candidate, candidate_iou = refine_iou(best_removal)
            if candidate_iou < min_iou:
                break
            refined, best_iou = candidate, candidate_iou
        simplified = (refined + min_xy)[:, np.newaxis, :]
    return simplified.squeeze(1).astype(np.float64) / resolution    # type: ignore