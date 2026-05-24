---
outline: [2, 3]
---

# Python Tools Introduction

`metadent-tools` is a lightweight Python package for reading and writing MetaDent datapoints
(image + metadata + labels) from local folders or an LFSS backend.

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

```py
from metadent_tools import connect, LocalDriver

driver = LocalDriver(image_dir="/local/images", meta_dir="/local/meta")

with connect(driver) as db:
    dp = db.load("000000001")
    image = dp.load_image()             # PIL.Image.Image
```

## Next

For practical workflows, see [Python Tools Use Cases](./py-tools-use-cases).
