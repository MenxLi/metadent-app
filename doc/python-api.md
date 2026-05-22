---
outline: [2, 3]
---

# Python API

The Python package under `py/` (named as `metadent-tools`) is a small helper library for reading MetaDent App datapoints (image + label) from either local folders or an LFSS backend.

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


## Loading Datapoints

The python tools allow loading datapoints from either local folders or an LFSS backend, with a unified `Driver` interface.

The first step is to create a driver instance, which specifies where the images and metadata are stored. 
```py
from metadent_tools import LocalDriver, LFSSDriver

# to load from local folders:
driver = LocalDriver(
    image_dir="/local/images",
    meta_dir="/local/meta",
)

# to load from LFSS:
driver = LFSSDriver(
    image_dir="/bucket/images",
    meta_dir="/bucket/meta",
)
```

Then, use the `connect` context manager to create a `Database` instance, which provide methods for loading datapoints. 

```py
from metadent_tools import connect

with connect(driver) as db:
    dp = db.load("000000001")           # load a single datapoint by its ID
    image = dp.load_image().result()    # load the image (returns a Future)
```

## Polygons (optional)

`metadent_tools.polygon` provides helpers for dealing with polygon annotations. 

For example, following code converts between polygon contours and binary masks:

```py
from metadent_tools import polygon

mask = polygon.polygons_to_mask(dp.label.items[0].contours, image.size)
polygons = polygon.mask_to_polygons(mask)
```

Requires OpenCV:

```sh
pip install opencv-python-headless
```
