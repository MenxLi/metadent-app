---
outline: [2, 3]
---

# Auxiliary AI Service Guide

[[toc]]

## Overview

The MetaDent App supports integration with an Auxiliary AI Service for automatic label generation.

This AI-assisted labeling feature is fully optional. If enabled, the frontend will send structured requests to a user-provided backend service.

:::info
We do not provide a ready-to-use AI backend service, as:

1. The implementation can vary greatly depending on your specific use case and the models you want to use.
2. Our model is not ready for public release yet. We may open-source it in the future after further development and testing.

Instead, we provide a clear API specification and design principles for you to develop your own custom AI service that best fits your needs.

:::

## Design Principles

- The frontend does **NOT** transmit image data, only the **image ID** is transmitted.
- All endpoints use HTTP `POST` method and exchange data in body as JSON format. (except the OpenAI proxy endpoint which should follow the OpenAI API spec)

The AI features are designed in a modular way, and the frontend will only call the endpoints that are supported by your backend.
Which can be configured in the user settings. 
This allows you to implement only the features that you need without worrying about the rest.


Below are the API specifications copied from the backend `fastapi`'s `pydantic` models and endpoint definitions. 
You can refer to these specifications when implementing your own backend service.

### Authentication

The frontend sends a Bearer token at request headers for authentication:

```
Authorization: Bearer <aiBackendToken>
```

Your backend may validate this token from this.

### Request and Response Schemas

```py
from metadent_tools.model import Polygon
from pydantic import BaseModel, Field

class OverallDescriptionRequest(BaseSchema):
    image_id: str

class OverallDescriptionEnhanceRequest(BaseSchema):
    image_id: str
    overall_description: str

class RegionDescriptionContext(BaseSchema):
    class _Item(BaseSchema):
        description: str
        contours: list[Polygon]
        low_confidence: bool = False

    items: list[_Item] = []
    overall_description: str = ""

class RegionDescriptionRequest(BaseSchema):
    image_id: str
    contours: list[Polygon]
    context: RegionDescriptionContext = Field(default_factory=RegionDescriptionContext)

class RegionRefineRequest(BaseSchema):
    image_id: str
    contours: list[Polygon]

class RegionRefineResponse(BaseSchema):
    image_id: str
    contours: list[Polygon]

class LLMResponse(BaseSchema):
    image_id: str
    choices: list[str]
```

## AI Features and API Endpoints
Below are the API endpoint specifications, 
using the above request and response schemas.

The first line is the endpoint path, 
and the following two lines are the request body and response body schema respectively.


### Overall description on image load
Automatically generates an overall description for the image on image load.

```
POST /overall-description 
OverallDescriptionRequest
LLMResponse
```

### Overall description enhancement
This toggles a more advanced overall description generation that takes the initial overall description as input and try to enhance it.
It contains two endpoints, one for generating a more complex description, 
and the other one is for simplifying the overall description into a more concise version.

```
POST /overall-description-complexify
OverallDescriptionEnhanceRequest
LLMResponse

POST /overall-description-simplify
OverallDescriptionEnhanceRequest
LLMResponse
```

### Region description on polygon draw
Generates a description for the user-selected region after drawing a polygon, with optional overall context information. 

```
POST /region-description
RegionDescriptionRequest
LLMResponse
```

### Polygon refinement on double click
Refines the polygon contour drawn by the user, typically using SAM or similar segmentation models.
```
POST /region-refine
RegionRefineRequest
RegionRefineResponse
```

### Chat with AI through OpenAI API proxy
If your backend provides the OpenAI API proxy endpoint, 
the frontend can open up a chat interface for users to directly chat with the AI and get responses from the OpenAI API.

```
[METHOD] /proxy/openai-v1/*
...
```
Any OpenAI compatible API route should be proxied through this endpoint, for example:
```
POST /proxy/openai-v1/chat/completions
...
```

::: warning
Currently the image for chat is send using lfss image url with token included !!
So **must use a self hosted OpenAI compatible server** to avoid potential data leak. Will add a safer image proxy for this in the future.
:::




<!-- 

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
  "image_id": "00032",
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
- `contours`: The polygon coordinates drawn by the user on the frontend. Format: `[[[x1, y1], [x2, y2], ...]]]`.
  This represents one or multiple polygons.
  The coordinates are normalized to [0, 1] range with respect to the image width and height.
  In the format of (x, y), where x is the horizontal coordinate (starting from the left) and y is the vertical coordinate (starting from the top).
- `context`: (optional) Additional context information that may help the AI generate better description. 
  It should be the label data of the entire image, exclude the current contour region. 
  The frontend will automatically prepare this context data and send along with the request if the backend supports it.

<label class="example-label">Example</label>

```json
{
  "image_id": "00032",
  "contours": [
    [[0.1, 0.2], [0.15, 0.25], [0.1, 0.3], ...],
    [[0.5, 0.5], [0.55, 0.55], [0.5, 0.6], ...],
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

### Polygon Refinement
```
POST /region-refine
```
Used to refine the polygon contour drawn by the user. 
This can typically be done with the SAM or similar segmentation models.

#### Request Body
- `image_id`: The unique identifier of the image.
- `contours`: The original polygon coordinates drawn by the user on the frontend. Format: `[[[x1, y1], [x2, y2], ...], [...], ...]]`.
  This represents one or multiple polygons. The coordinates are the same that sent in the region description endpoint.

#### Response Body
- `image_id`: The unique identifier of the image, just echo back from the request.
- `contours`: The refined polygon coordinates. Format: `[[[x1, y1], [x2, y2], ...], [...], ...]]`. The format is the same as the request.


### OpenAI API Proxy
```
[METHOD] /proxy/openai-v1/*
```
This is an optional proxy endpoint for the frontend to send requests to OpenAI compatible API routes (e.g. `POST /proxy/openai-v1/chat/completions` for GPT-based models).
If your AI backend provides this endpoint, the frontend can open up a chat interface for users to directly chat with the AI and get responses from the OpenAI API. 

The proxy should authorize the request against the same AI backend token instead of the OpenAI API key.

::: warning
Currently the image for chat is send using lfss image url with token included !!

So **must use a self hosted OpenAI compatible server** to avoid potential data leak. Will add a safer image proxy for this in the future.
:::


## Frontend Behavior

AI features can be enabled as needed in the user settings:

<img src="https://metadent.limengxun.com:8000/doc/images/configure-ai-features.png" alt="Configure AI Features" style="max-width: 300px; height: auto; border: 1px solid #ccc; border-radius: 4px; margin: 1em 0;">

Click on 'Enable AI assisted labeling' to enable the AI features, and fill in the backend URL and token if you have one.

At the bottom of the settings, you can toggle specific features on or off:
The names are self-explanatory, if all of the AI backend is properly configured and enabled,
the frontend will:

- Automatically request overall image description when a new image is loaded.
- After the user finishes drawing a polygon, it will request the description for that region.
- Double click on a polygon to trigger the refinement and update the polygon.
- Open up a chat interface for users to directly chat with the AI about the image. -->

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
