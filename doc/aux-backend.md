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

- The frontend does **NOT** transmit image data.
- Only the **image ID (`idx`)** is transmitted.
- The AI backend must retrieve image data from its own database or storage system.
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

```json
{
  "idx": "image_id"
}
```

#### Response Body

```json
{
  "idx": "image_id",
  "output": "The generated description (or null if generation fails)"
}
```

#### Description

- `idx`: The unique identifier of the image.

### Region Description

```
POST /region-description
```

Used to generate a description of a user-selected polygon region.

#### Request Body

```json
{
  "idx": "image_id",
  "contours": [
    [[x1, y1], [x2, y2], ...],
    [[x3, y3], [x4, y4], ...],
    ...
  ]
}
```

#### Response Body

```json
{
  "idx": "image_id",
  "output": "The generated description (or null if generation fails)"
}
```

#### Description

- `idx`: Image ID.
- `contours`: Polygon coordinates drawn by the user.
  - Format: `[[[x1, y1], [x2, y2], ...]]`
  - Represents one or multiple polygons.

The backend must:

- Load the image using `idx`
- Use the provided coordinates to extract the corresponding region
- Generate region-specific descriptions

## Frontend Behavior and Error Handling

If the AI backend is properly configured,
the frontend will:

1. Call the above overall description endpoint when the user clicks the AI generation button at the overall description area.
2. In addition, when user draws a polygon region, the frontend will automatically call the region description endpoint to generate a description for the drawn region.

The frontend will automatically disable AI auto-generation if:

- Backend URL is missing
- HTTP request fails

If AI fails, the user is automatically switched to manual input mode.

Your backend should:

- Return JSON responses or return errors with proper status codes
- Avoid long blocking operations without timeouts

<style scoped>
  h3 {
    color: var(--vp-c-brand);
  }
</style>
