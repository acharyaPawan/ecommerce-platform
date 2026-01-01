# Catalog Service API

## Overview
The catalog service owns canonical product data (products, variants, prices, media, categories) and emits catalog domain events. Read endpoints are publicly consumable through the gateway, while write endpoints are internal and require administrative scopes.

## Base URL
- Internal service URL: `http://catalog-svc:3002`
- REST prefix: `/api/catalog`

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness probe. Returns `{ service: "catalog-svc", status: "ok" }`. |
| `GET` | `/healthz` | Lightweight health probe. |
| `GET` | `/readyz` | Readiness probe. |

## Authentication
- All read endpoints accept anonymous requests (JWT optional). 
- Write endpoints require an IAM-issued JWT containing the `catalog:write` scope.
- Include the token via `Authorization: Bearer <jwt>`.

## Product Representation
```jsonc
{
  "id": "uuid",
  "title": "string",
  "description": "string|null",
  "brand": "string|null",
  "status": "draft|published|archived",
  "categories": [{ "id": "string", "name": "string" }],
  "media": [{ "id": "uuid", "url": "https://...", "altText": "string|null", "sortOrder": 0 }],
  "variants": [
    {
      "id": "uuid",
      "sku": "SKU-123",
      "status": "active|discontinued",
      "attributes": { "size": "M" },
      "prices": [
        {
          "id": "uuid",
          "currency": "USD",
          "amountCents": 2500,
          "effectiveFrom": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Public Read APIs

### List Products
`GET /api/catalog/products`

| Query | Type | Notes |
| --- | --- | --- |
| `status` | `draft` &#124; `published` &#124; `archived` &#124; `all` (default `published`) | Filters by lifecycle status. |
| `limit` | `1-100` (default `20`) | Page size. |
| `cursor` | `string` | Opaque cursor returned from previous page. |
| `q` | `string` | Case-insensitive search on title, brand, or description. |

**Response** `200 OK`
```json
{
  "items": [/* Product objects */],
  "nextCursor": "base64url-string or omitted when no more pages"
}
```

Errors: `422` when query params fail validation; `500` for unexpected failures.

### Get Product by ID
`GET /api/catalog/products/:productId`

- Returns a single product or `404` when not found.
- `400` when `productId` is blank.

## Internal Write APIs

### Create Product
`POST /api/catalog/products`

| Requirement | Description |
| --- | --- |
| Auth | `Authorization: Bearer <jwt>` with `catalog:write` scope. |
| Idempotency | Optional `Idempotency-Key` header. When provided, repeated requests return `200 OK` with `x-idempotent-replay: true`. |

```jsonc
{
  "title": "string",                     // required
  "description": "string?",              // optional
  "brand": "string?",
  "status": "draft|published|archived",  // default "draft"
  "categories": [{ "id": "tops", "name": "Tops" }],
  "media": [{ "url": "https://cdn/asset.png", "sortOrder": 0, "altText": "Shot" }],
  "variants": [
    {
      "sku": "SKU-123",
      "status": "active",
      "attributes": { "size": "S" },
      "prices": [
        { "currency": "USD", "amountCents": 2500, "effectiveFrom": "2024-01-01T00:00:00Z" }
      ]
    }
  ]
}
```

Responses:
- `201 Created` with `{ "productId": "uuid" }` when new product inserted.
- `200 OK` with `x-idempotent-replay: true` if the same idempotency key replays.
- `400` invalid JSON, `422` schema validation failure, `401/403` auth errors, `500` other failures.
