---
outline: [2, 3]
---

# Auxiliary AI Service Guide

[[toc]]

## Overview

The MetaDent App supports optional integration with an Auxiliary AI Service for automatic label generation.

This AI-assisted labeling feature is fully optional. If enabled, the frontend will send structured requests to a user-provided backend service. If disabled or misconfigured, the application will automatically fall back to manual labeling.

:::info
We do not provide a ready-to-use AI backend service, as:

1. The implementation can vary greatly depending on your specific use case and the models you want to use.
2. Our model is not ready for public release yet. We may open-source it in the future after further development and testing.

Instead, we provide a clear API specification and design principles for you to develop your own custom AI service that best fits your needs.

:::

## Design Principles

- The frontend does **NOT** transmit image data, only the **image ID** is transmitted.
- All endpoints use HTTP `POST` method and exchange data in body as JSON format.

## Authentication

If configured, the frontend sends a Bearer token at request headers for authentication:

```
Authorization: Bearer <aiBackendToken>
```

Your backend may validate this token from this.

## API Endpoints

### Overall Image Description

```
POST /overall-description
```

Used to generate a global description of the entire image.

#### Request Body

- `image_id`: The unique identifier of the image for which to generate the description.

<label class="example-label">Example</label>

```json
{
  "image_id": "00032"
}
```

#### Response Body

- `image_id`: The unique identifier of the image, just echo back from the request.
- `output`: The generated description for the image. If generation fails, this can be null

<label class="example-label">Example</label>

```json
{
  "idx": "00032",
  "output": "This image shows a patient with multiple dental caries, particularly on the molars. The overall oral hygiene appears poor, with visible plaque accumulation and gingival inflammation."
}
```

### Region Description

```
POST /region-description
```

Used to generate a description of a user-selected polygon region.

#### Request Body

- `image_id`: The unique identifier of the image.
- `contours`: The polygon coordinates drawn by the user on the frontend. Format: `[[[x1, y1], [x2, y2], ...]]`.
  This represents one or multiple polygons.
  The coordinates are normalized to [0, 1] range with respect to the image width and height.
  In the format of (x, y), where x is the horizontal coordinate (starting from the left) and y is the vertical coordinate (starting from the top).

<label class="example-label">Example</label>

```json
{
  "image_id": "00032",
  "contours": [
    [[0.1, 0.2], [0.15, 0.25], [0.1, 0.3], ...],
    [[0.5, 0.5], [0.55, 0.55], [0.5, 0.6], ...]
    ...
  ]
}
```

#### Response Body

- `image_id`: The unique identifier of the image, just echo back from the request.
- `output`: The generated description for the specified region. If generation fails, this can be null.

<label class="example-label">Example</label>

```json
{
  "image_id": "00032",
  "output": "#46 haves a large caries lesion on the occlusal surface."
}
```

## Frontend Behavior and Error Handling

AI features can be enabled as needed in the user settings:

<img src="https://metadent.limengxun.com:8000/doc/images/configure-ai-features.png" alt="Configure AI Features" style="max-width: 300px; height: auto; border: 1px solid #ccc; border-radius: 4px; margin: 1em 0;">

Click on 'Enable AI assisted labeling' to enable the AI features, and fill in the backend URL and token if you have one.

At the bottom of the settings, you can toggle specific features on or off:
The names are self-explanatory, if all of the AI backend is properly configured and enabled,
the frontend will:

- Automatically request overall image description when a new image is loaded.
- After the user finishes drawing a polygon, it will request the description for that region.

<style scoped>
  h3 {
    color: var(--vp-c-brand);
  }
  .example-label {
    display: inline-block;
    margin-top: 0;
    margin-bottom: 0;
    padding: 0.1em 0.5em;
    background-color: #b5c6d044;
    color: var(--vp-c-brand-2);
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: bold;
  }
</style>
