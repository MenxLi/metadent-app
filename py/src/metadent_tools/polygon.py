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
    ) -> Polygon:
    """Simplify a polygon using opencv approxPolyDP (Ramer-Douglas-Peucker algorithm)."""
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
    return simplified.squeeze(1).astype(np.float64) / resolution    # type: ignore