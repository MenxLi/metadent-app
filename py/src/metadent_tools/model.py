from __future__ import annotations
import numpy as np
import json
from io import BytesIO
from PIL import Image
from contextlib import contextmanager
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

class DataSkipFlag(BaseSchema):
    reason: str
    skip_time: str

@dataclass
class DataPoint:
    identifier: str
    load_image: Callable[[], Image.Image]
    info: DataInfo
    label: Optional[DataLabel] = None
    skip: Optional[DataSkipFlag] = None

    @staticmethod
    def from_bare_image(
        identifier: str,
        image: Image.Image,
        image_format: str = "jpg",
        source: str = "unknown",
    ):
        info = DataInfo(
            file_name=f"{identifier}.{image_format}",
            source=source,
            width=image.width,
            height=image.height
        )
        def load_image():
            return image
        return DataPoint(identifier=identifier, load_image=load_image, info=info)


@contextmanager
def connect(driver: DriverAbstract):
    try:
        driver._maybe_connect()
        yield Database(driver=driver)
    except: raise
    finally: 
        driver._maybe_disconnect()


@dataclass
class Database:
    driver: DriverAbstract

    def load(self, identifier: str):
        info_path = self.driver.meta_dir / identifier / "info.json"
        label_path = self.driver.meta_dir / identifier / "label.json"
        skip_path = self.driver.meta_dir / identifier / "skip.json"

        fetch_result = self.driver.check_many([info_path, label_path, skip_path], read_text=True)
        info = DataInfo(**json.loads(info_text)) if (info_text:=fetch_result[info_path]) is not None else None
        label = DataLabel(**json.loads(label_text)) if (label_text:=fetch_result[label_path]) is not None else None
        skipped = DataSkipFlag(**json.loads(skip_text)) if (skip_text:=fetch_result[skip_path]) is not None else None

        if info is None:
            raise FileNotFoundError(f"Data info not found for data_id: {identifier}")
        
        def load_image():
            image_path = self.driver.image_dir / info.file_name
            image_bytes = self.driver.read_bytes(image_path)
            return Image.open(BytesIO(image_bytes)).convert("RGB")
        return DataPoint(identifier=identifier, load_image=load_image, info=info, label=label, skip=skipped)
    
    def dump(self, data_point: DataPoint):
        """
        Dump a data point to the database. 
        This is a sync operation: 
            - if a destination file already exists, it will be overwritten.
            - if some field are set to None, the corresponding file will be deleted if exists.
        """
        identifier = data_point.identifier

        info_path = self.driver.meta_dir / identifier / "info.json"
        label_path = self.driver.meta_dir / identifier / "label.json"
        skip_path = self.driver.meta_dir / identifier / "skip.json"
        image_path = self.driver.image_dir / data_point.info.file_name

        self.driver.write_json(info_path, data_point.info.model_dump(by_alias=True))

        if data_point.label is not None:
            self.driver.write_json(label_path, data_point.label.model_dump(by_alias=True))
        else:
            self.driver.delete(label_path)

        if data_point.skip is not None:
            self.driver.write_json(skip_path, data_point.skip.model_dump(by_alias=True))
        else:
            self.driver.delete(skip_path)
        
        image_bytes_io = BytesIO()
        data_point.load_image().save(image_bytes_io, format="JPEG")
        self.driver.write_bytes(image_path, image_bytes_io.getvalue())