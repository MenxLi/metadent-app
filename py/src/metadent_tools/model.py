from __future__ import annotations
from io import BytesIO
import numpy as np
from PIL import Image
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Optional, Literal, Callable, Annotated

from dataclasses import dataclass
from pydantic import BaseModel, ConfigDict
from pydantic import BeforeValidator, PlainSerializer
from pydantic.alias_generators import to_camel

from .driver import DriverAbstract

def _contour_before_validator(value):
    if isinstance(value, list):
        return np.array(value, dtype=np.float64)
    elif isinstance(value, np.ndarray):
        return value.astype(np.float64)
    else:
        raise ValueError("Invalid contour format")

def _contour_serializer(value: np.ndarray) -> list[list[float]]:
    return value.astype(float).tolist()

Polygon = Annotated[
    np.ndarray[tuple[int, Literal[2]], np.dtype[np.float64]],
    BeforeValidator(_contour_before_validator), 
    PlainSerializer(_contour_serializer)
]


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class DataLabel(BaseSchema):
    annotators: list[str]
    overall_description: str
    items: list[LabelItem]
    crop: Optional[tuple[int, int, int, int]] = None     # [x, y, w, h]

class LabelItem(BaseSchema):
    id: str
    color: str
    low_confidence: bool
    description: str
    auto_generated: bool = False
    contours: list[Polygon]
    pre_refine_contours: Optional[list[Polygon]] = None

class DataInfo(BaseSchema):
    file_name: str
    source: str
    width: int
    height: int

    def image_size(self) -> tuple[int, int]:
        """image size as (width, height)"""
        return (self.width, self.height)

@dataclass
class DataPoint:
    load_image: Callable[[], Future[Image.Image]]
    info: DataInfo
    label: Optional[DataLabel]


@contextmanager
def connect(driver: DriverAbstract, n_threads: Optional[int] = None):
    with ThreadPoolExecutor(max_workers=n_threads) as pool:
        yield Database(driver=driver, thread_pool=pool)

@dataclass
class Database:
    driver: DriverAbstract
    thread_pool: ThreadPoolExecutor

    def load(self, data_id: str):
        info_future = self.thread_pool.submit(
            lambda: DataInfo(**self.driver.read_json(self.driver.meta_dir / data_id / "info.json"))
        )
        label_future = self.thread_pool.submit(
            lambda: DataLabel(**self.driver.read_json(self.driver.meta_dir / data_id / "label.json")) 
                if self.driver.exists(self.driver.meta_dir / data_id / "label.json") else None
        )

        info = info_future.result()
        label = label_future.result()
        image_path = self.driver.image_dir / info.file_name
        def image_getter():
            image_blob = self.driver.read_bytes(image_path)
            return Image.open(BytesIO(image_blob)).convert("RGB")
            
        return DataPoint(
            load_image=lambda: self.thread_pool.submit(image_getter), 
            info=info, 
            label=label, 
            )
    
    def load_many(self, data_ids: list[str]) -> list[DataPoint]:
        load_futures = [self.thread_pool.submit(self.load, data_id) for data_id in data_ids]
        return [future.result() for future in load_futures]