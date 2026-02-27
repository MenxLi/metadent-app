# Auxiliary AI Service Guide

## Overview

The MetaDent App supports optional integration with an Auxiliary AI Service for automatic label generation.

This AI-assisted labeling feature is fully optional. If enabled, the frontend will send structured requests to a user-provided backend service. If disabled or misconfigured, the application will automatically fall back to manual labeling.

## Design Principles

* The frontend does **NOT** transmit image data.
* Only the **image ID (`idx`)** is transmitted.
* The AI backend must retrieve image data from its own database or storage system.

This design minimizes bandwidth usage and improves security and scalability.

## Required API Endpoints

Your AI backend must expose HTTP `POST` endpoints.

The frontend will send requests to:

```
{AI_BACKEND_URL}/{route}
```

### Required Routes

#### Overall Image Description

```
POST /overall-description
```

Used to generate a global description of the entire image.

##### Request Body

```json
{
  "idx": "image_id"
}
```

##### Description

* `idx`: The unique identifier of the image.
* Backend must retrieve the image using this ID.

#### Region Description

```
POST /region-description
```

Used to generate a description of a user-selected polygon region.

##### Request Body

```json
{
  "idx": "image_id",
  "contours": [
    [[x1, y1], [x2, y2], ...]
  ]
}
```

##### Description

* `idx`: Image ID.
* `contours`: Polygon coordinates drawn by the user.

  * Format: `[[[x1, y1], [x2, y2], ...]]`
  * Represents one or multiple polygons.

The backend must:

* Load the image using `idx`
* Use the provided coordinates to extract the corresponding region
* Generate region-specific descriptions

## Authentication

If configured, the frontend sends a Bearer token:

```
Authorization: Bearer <aiBackendToken>
```

Your backend may:

* Validate the token
* Ignore it (if running in a trusted environment)

Token validation is optional but recommended in production.

## Required Response Format

Your backend **must return JSON** in the following format:

```python
class InferResponse(BaseModel):
    idx: str
    question: str
    output: Optional[str]
```

### Field Definitions

| Field    | Type           | Description                               |
| -------- | -------------- | ----------------------------------------- |
| idx      | string         | Image ID (must match request)             |
| question | string         | The constructed prompt used for inference |
| output   | string or null | Model-generated description               |

## Frontend Behavior and Error Handling

The frontend:

* Automatically disables AI auto-generation if:

  * Backend URL is missing
  * HTTP request fails

If AI fails, the user is automatically switched to manual input mode.

Your backend should:

* Return JSON responses or return errors with proper status codes
* Avoid long blocking operations without timeouts
