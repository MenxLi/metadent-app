
from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .model import DataPoint

_TEMPLATE_NAME = "visualize.template.html"
_TEMPLATE_DIR = Path(__file__).resolve().parent / "assets"


def _polygon_to_list(polygon: Any) -> list[list[float]]:
    return [[float(point[0]), float(point[1])] for point in polygon]


def _image_to_data_url(dp: DataPoint) -> str:
    image = dp.load_image().convert("RGB")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _build_payload(dp: DataPoint) -> dict[str, Any]:
    label_items: list[dict[str, Any]] = []
    if dp.label:
        for item in dp.label.items:
            label_items.append(
                {
                    "id": item.id,
                    "color": item.color,
                    "description": item.description,
                    "low_confidence": item.low_confidence,
                    "auto_generated": item.auto_generated,
                    "contours": [_polygon_to_list(c) for c in item.contours],
                    "pre_refine_contours": (
                        [_polygon_to_list(c) for c in item.pre_refine_contours]
                        if item.pre_refine_contours is not None
                        else []
                    ),
                }
            )

    return {
        "identifier": dp.identifier,
        "image_src": _image_to_data_url(dp),
        "image": {
            "width": dp.info.width,
            "height": dp.info.height,
        },
        "info": dp.info.model_dump(),
        "label": (dp.label.model_dump() if dp.label else None),
        "skip": (dp.skip.model_dump() if dp.skip else None),
        "items": label_items,
    }


def render_datapoint_html(dp: DataPoint) -> str:
    """
    Render the data point into a standalone visualization HTML string.

    The page includes:
    - the image
    - overlay contours from label items
    - readable metadata sections (info/label/skip)
    - simple controls for visibility and opacity
    """
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template(_TEMPLATE_NAME)
    return template.render(
        payload=_build_payload(dp),
        page_title=f"Metadent Visualizer - {dp.identifier}",
    )