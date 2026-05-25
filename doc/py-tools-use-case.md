---
outline: [2, 3]
---

# Python Tools Use Cases

This page shows common workflows using `metadent-tools`.

## 1. Load a Datapoint

The `load` method loads all metadata fields and returns a `DataPoint` object, 
the image can be obtained by calling `load_image()`.

```py
from metadent_tools import connect, LFSSDriver

with connect(LFSSDriver("bucket/images", "bucket/meta")) as db:
    dp = db.load("demo-0001")
    image = dp.load_image()        # PIL.Image.Image
```

You can also get the image size without loading the entire image:

```py
image_size = dp.image_size()  # (width, height)
```

## 2. Create a Datapoint

You can create a `DataPoint` from barely an image and set other metadata fields as needed, 
then dump it to the database:

```py
from metadent_tools import connect, InMemoryDriver, DataPoint
from PIL import Image

with connect(InMemoryDriver("images", "meta")) as db:
    # use .with_label() to initialize an empty label field
    dp = DataPoint.from_bare_image(
        identifier="demo-0001",
        image=Image.new("RGB", (100, 100), color="red"),
    ).with_label()
    dp.label.overall_description = "this is a red square"
    db.dump(dp)
```

## 3. Port Datapoints Between Databases

Sometimes you may want to download a datapoint from a remote database to your local filesystem, or reverse. 
This can be achieved by loading the datapoint from one database and dumping it to another.

```py
from metadent_tools import connect, LFSSDriver, LocalDriver
with (
    connect(LFSSDriver("bucket/images", "bucket/meta")) as remote_db, 
    connect(LocalDriver("local_images", "local_meta")) as local_db
    ):
    dp = remote_db.load("demo-0001")
    local_db.dump(dp)
```

## 4. Render a Visualization HTML
This is useful for inspecting a datapoint for debugging or sharing with others. 
The rendered HTML will show the image, polygon labels, and metadata in a structured format, 
allowing toggle contour visibility and easy inspection of all fields.

```py
from pathlib import Path
from metadent_tools import connect, LocalDriver
from metadent_tools.visualize import render_datapoint_html

driver = LocalDriver(image_dir="/local/images", meta_dir="/local/meta")

with connect(driver) as db:
    dp = db.load("demo-0001")
    html = render_datapoint_html(dp)

Path("datapoint-preview.html").write_text(html, encoding="utf-8")
```

Open `datapoint-preview.html` in your browser to inspect the datapoint.

## 5. Convert Between Polygons and Masks

```py
from metadent_tools import polygon

# polygons -> mask
mask = polygon.polygons_to_mask(dp.label.items[0].contours, dp.image_size())

# mask -> polygons
polygons = polygon.mask_to_polygons(mask)
```

This requires OpenCV, so make sure to install the extra dependencies:

```sh
pip install opencv-python-headless
```
> OpenCV is not a required dependency because it has variant packages and may cause conflicts in some environments.
