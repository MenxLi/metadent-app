---
outline: [2, 3]
---

# Python Tools Introduction

`metadent-tools` is a lightweight Python package for reading and writing MetaDent datapoints
(image + metadata) from different storage backends. 

## Install

From the repository root:

```sh
pip install -e ./py
```

:::details Or install directly from GitHub (no local clone required):

```sh
pip install "git+https://github.com/MenxLi/metadent-app.git@main#subdirectory=py"
```
Tip: replace `@main` with a tag or commit SHA for a reproducible install.
:::

## Core Concepts

- `Driver`: storage backend abstraction (`LocalDriver`, `LFSSDriver`, `InMemoryDriver`).
- `connect(driver)`: context manager that opens a `Database` session.
- `Database`: high-level IO API (`load`, `dump`).
- `DataPoint`: one sample containing image loader + structured metadata.

## Driver Interface

All drivers expose the same behavior, so your read/write code stays the same:

```py
from metadent_tools import LocalDriver, LFSSDriver, InMemoryDriver

# Local filesystem
local_driver = LocalDriver(
    image_dir="/local/images",
    meta_dir="/local/meta",
)

# LFSS backend
lfss_driver = LFSSDriver(
    image_dir="/bucket/images",
    meta_dir="/bucket/meta",
)

# In-memory storage (testing)
mem_driver = InMemoryDriver(
    image_dir="images",
    meta_dir="meta",
)
```

## Basic Loading

The basic workflow to load a datapoint is:
- Create a driver for your storage backend
- Connect to the database using the driver as dependency
- Load a datapoint by ID (or create a new one)
- Lazy-load the image as needed

```py
from metadent_tools import connect, LocalDriver

driver = LocalDriver(image_dir="/local/images", meta_dir="/local/meta")

with connect(driver) as db:
    dp = db.load("000000001")
    image = dp.load_image()             # PIL.Image.Image
```

## Core Data Structures

The core data structures are defined in [`metadent_tools.model`](https://github.com/MenxLi/metadent-app/blob/main/py/src/metadent_tools/model.py). 
The `BaseSchema` inheritances reflecting the structure of the storage JSON files, 
and the `DataPoint` class is designed for high-level representation of the image / metadata pair, 
with convenient methods for common operations.

> Note that the field are *snake_case* in python but they are *camelCase* in the JSON files, the conversion is handled by `pydantic`'s aliasing feature.


```py
# 2D array of shape (N, 2), 
# and each point is represented as [x, y] (top-left origin), 
# with normalized coordinates in the range [0, 1).
type Polygon = np.ndarray[tuple[int, Literal[2]], np.dtype[np.float64]],

class DataLabel(BaseSchema):
    annotators: list[str]
    overall_description: str
    items: list[LabelItem]
    crop: Optional[tuple[float, float, float, float]] = None     # [x, y, w, h]

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
    info: DataInfo
    label: Optional[DataLabel] = None
    skip: Optional[DataSkipFlag] = None

    def load_image(self) -> Image.Image: ...
    def image_size(self) -> tuple[int, int]: ...
    def with_label(self) -> Self: ...
    def apply_crop(self) -> Self: ...
    def set_skip(self, reason: str) -> Self: ...
    def new_label_item(self) -> LabelItem: ...

    @staticmethod
    def from_bare_image(identifier: str, image: Image.Image) -> Self: ...

```


## Next

For practical workflows, see [Python Tools Use Cases](./py-tools-use-case).
