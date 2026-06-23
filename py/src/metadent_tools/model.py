from __future__ import annotations
import numpy as np
import json
from io import BytesIO
from PIL import Image
from contextlib import contextmanager
from typing import Optional, Literal, Callable, Annotated, TypeAlias
import uuid, random

from dataclasses import dataclass
from pydantic import BaseModel, ConfigDict
from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema
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

# 2D array of shape (N, 2), 
# and each point is represented as [x, y] (top-left origin), 
# with normalized coordinates in the range [0, 1).
# impl references: 
# - https://pydantic.dev/docs/validation/dev/concepts/json_schema/#withjsonschema-annotation
Polygon: TypeAlias = Annotated[
    np.ndarray[tuple[int, Literal[2]], np.dtype[np.float64]],
    BeforeValidator(_contour_before_validator), 
    PlainSerializer(_contour_serializer), 
    WithJsonSchema({
        "type": "array",
        "items": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 2,
            "maxItems": 2
        },
        "examples": [
            [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
            [[0.0, 0.0], [0.0, 0.5], [0.5, 0.5], [0.5, 0.0]]
        ]
    })
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
    crop: Optional[tuple[float, float, float, float]] = None     # [x, y, w, h]
    abnormality_exhausted: bool = True

    def __bool__(self):
        return bool(self.items) or bool(self.overall_description.strip())

    def add_item(self) -> LabelItem:
        it = LabelItem(
            id=str(uuid.uuid4()),
            color="#%06x" % random.randint(0, 0xFFFFFF),
            low_confidence=False,
            description="",
            contours=[],
        )
        self.items.append(it)
        return it

    def sanitize(self):
        """ 
        Remove typical illegal states for the label (currently as follows, may be extended in the future): 
        - Any contour with less than 3 points will be removed, since it cannot form a valid polygon.
        - Item with no valid contour, or without description will be removed.
        """
        for item in self.items:
            item.contours = [contour for contour in item.contours if contour.shape[0] >= 3]
            if item.pre_refine_contours is not None:
                item.pre_refine_contours = [contour for contour in item.pre_refine_contours if contour.shape[0] >= 3]
        self.items = [item for item in self.items if len(item.contours) > 0 and item.description.strip() != ""]
        return self

class LabelItem(BaseSchema):
    id: str
    color: str
    low_confidence: bool
    description: str
    contours: list[Polygon]
    auto_generated: Optional[bool] = None
    pre_refine_contours: Optional[list[Polygon]] = None

class DataInfo(BaseSchema):
    file_name: str
    source: str
    width: int
    height: int

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
        """
        Create a DataPoint from a bare image, without any label or skip info.
        The format determines the image file name extension, 
        will be saved in that format when dumped to a database.
        """
        info = DataInfo(
            file_name=f"{identifier}.{image_format}",
            source=source,
            width=image.width,
            height=image.height
        )
        def load_image():
            return image
        return DataPoint(identifier=identifier, load_image=load_image, info=info)
    
    def copy(
        self, 
        override_identifier: Optional[str] = None, 
        detach_image: bool = False
        ) -> DataPoint:
        """ 
        Create a copy of the current data point. 
        (HINT: to copy attribute by attribute, you can use the pydantic `model_copy()` method)
        - override_identifier: 
            if provided, the new data point will have the identifier set to it, 
            and the file name in info will also be updated accordingly;
        - detach_image:
            if set to True, the image will be digested and kept in memory as closure,
            making the image detached from the original data point.
        """
        info = self.info.model_copy()
        if override_identifier and override_identifier.strip() != "":
            info.file_name = f"{override_identifier}.{info.file_name.split('.')[-1]}"
            identifier = override_identifier
        else:
            identifier = self.identifier

        if detach_image:
            closured_image = self.load_image()
            def load_image_digested():
                return closured_image
            load_image = load_image_digested
        else:
            load_image = self.load_image

        return DataPoint(
            identifier=identifier,
            load_image=load_image,
            info=info,
            label=self.label.model_copy() if self.label else None,
            skip=self.skip.model_copy() if self.skip else None
        )

    def image_size(self) -> tuple[int, int]:
        """image size as (width, height)"""
        return (self.info.width, self.info.height)
    
    def set_skip(self, reason: str, skip_time: Optional[str] = None):
        import datetime
        if skip_time is None:
            local_zone = datetime.datetime.now().astimezone().tzinfo
            skip_time = datetime.datetime.now(tz=local_zone).isoformat()
        self.skip = DataSkipFlag(reason=reason, skip_time=skip_time)
        return self
    
    def with_label(self, skip_if_exists: bool = True):
        """ Initialize the label field if not exists.  """
        if self.label is not None and skip_if_exists:
            return self
        self.label = DataLabel(
            annotators=[],
            overall_description="",
            items=[], 
            crop=None
        )
        return self
    
    def apply_crop(self):
        """
        If crop label is available, apply the crop to the current data point, 
        and then clear the crop info in the label.
        """
        if not self.label or not self.label.crop:
            return self

        original_image_size_wh = np.array(self.image_size(), dtype=np.int32)
        original_image_loader = self.load_image

        xywh_f = np.array(self.label.crop, dtype=np.float64)
        xywh_i = np.concatenate((original_image_size_wh * xywh_f[:2], original_image_size_wh * xywh_f[2:4]))
        x, y, w, h = xywh_i.astype(np.int32)

        # update info
        self.info.width = int(w)
        self.info.height = int(h)

        # update image loader
        def load_image_new():
            return original_image_loader().crop((x, y, x+w, y+h))
        self.load_image = load_image_new

        # update label
        def crop_contours(contours: list[Polygon]) -> list[Polygon]:
            eps = 1e-6
            for i in range(len(contours)):
                if contours[i].shape[0] == 0:
                    continue
                contours[i][:, 0] -= xywh_f[0]
                contours[i][:, 1] -= xywh_f[1]
                contours[i][:, 0] /= xywh_f[2]
                contours[i][:, 1] /= xywh_f[3]
            contours = [contour for contour in contours if not np.all((contour < eps) | (contour > 1-eps))]
            return contours
        for item in self.label.items:
            item.contours = crop_contours(item.contours)
            if item.pre_refine_contours is not None:
                item.pre_refine_contours = crop_contours(item.pre_refine_contours)

        # update crop field
        self.label.crop = None
        return self

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
        image_path = self.driver.image_dir / data_point.info.file_name
        image_bytes_io = BytesIO()
        data_point.load_image().save(image_bytes_io, format="JPEG")
        self.driver.write_bytes(image_path, image_bytes_io.getvalue())

        self.dump_meta(data_point, validate=False)
    
    def dump_meta(self, data_point: DataPoint, validate: bool = True):
        """
        Dump only the meta info of a data point to the database, without touching the image file.
        This is useful when you want to update the label or skip info of a data point without changing the image.
        """
        identifier = data_point.identifier

        if validate:
            image_path = self.driver.image_dir / data_point.info.file_name
            if not self.driver.exists(image_path):
                raise FileNotFoundError(f"Image file not found for data_id: {identifier}, expected at: {image_path}")

        info_path = self.driver.meta_dir / identifier / "info.json"
        label_path = self.driver.meta_dir / identifier / "label.json"
        skip_path = self.driver.meta_dir / identifier / "skip.json"

        self.driver.write_json(info_path, data_point.info.model_dump(by_alias=True))

        if data_point.label is not None:
            self.driver.write_json(label_path, data_point.label.model_dump(by_alias=True))
        else:
            self.driver.delete_if_exists(label_path)

        if data_point.skip is not None:
            self.driver.write_json(skip_path, data_point.skip.model_dump(by_alias=True))
        else:
            self.driver.delete_if_exists(skip_path)