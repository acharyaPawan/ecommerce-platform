# Cart Service API

## Overview
Cart service manages anonymous and signed-in carts, enforces item-level validation, performs cart merges, and orchestrates checkout by issuing signed cart snapshots and optional downstream order placement. It is internal (consumed by gateway) but its contract is stable for other backend consumers.

## Base URL
- Internal service URL: `http://cart-svc:3004`
- REST prefix: `/api/cart`

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness check `{ service, status }`. |
| `GET` | `/healthz` | Health probe. |
| `GET` | `/readyz` | Readiness probe. |

## Authentication & Context Headers
| Header | Required | Description |
| --- | --- | --- |
| `Authorization: Bearer <jwt>` | Optional | Associates requests with an authenticated user when provided. |
| `X-Cart-Id` | Optional | Allows anonymous cart retrieval/mutations. Required for merge operations. |
| `X-Cart-Currency` | Optional | Override default currency when creating a cart. |
| `Idempotency-Key` | Required for all mutating requests | Deduplicates retries. Responds with `400` when missing. |

At least one of `Authorization` or `X-Cart-Id` must be present for most operations.

## Cart Representation
```jsonc
{
  "id": "uuid",
  "userId": "user-123|null",
  "currency": "USD",
  "status": "active|checked_out",
  "version": 4,
  "items": [
    {
      "sku": "SKU-123",
      "qty": 2,
      "variantId": "variant-1",
      "selectedOptions": { "size": "M" },
      "metadata": { "gift": true }
    }
  ],
  "totals": { "itemCount": 1, "totalQuantity": 2 },
  "pricingSnapshot": {
    "subtotalCents": 5000,
    "currency": "USD",
    "itemCount": 1,
    "totalQuantity": 2,
    "computedAt": "2024-01-01T00:00:00.000Z"
  },
  "appliedCoupon": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:05:00.000Z"
}
```

Responses include cache headers (`x-cart-id`, `x-cart-version`, `etag`) to assist clients with concurrency control.

## Endpoints

### Retrieve Cart
`GET /api/cart`

- Requires `Authorization` or `X-Cart-Id`.
- Returns the active cart, creating one for authenticated users if absent.
- Errors: `400` when missing identifiers, `404` if no cart exists for provided context.

### Add Item
`POST /api/cart/items`

| Body Field | Type | Notes |
| --- | --- | --- |
| `sku` | `string` | Required SKU (case-insensitive). |
| `qty` | `number` | Positive integer, respects `maxQtyPerItem`. |
| `variantId` | `string?` | Optional variant identifier. |
| `selectedOptions` | `Record<string,string>?` | Normalized to lowercase keys. |
| `currency` | `string?` | Optional override when creating a new anonymous cart. |
| `metadata` | `Record<string,string|number|boolean|null>?` | Stored with the line item. |

Responses:
- `201 Created` when a new cart or line item is created.
- `200 OK` when the line already existed and was updated.
- `x-idempotent-replay: true/false` indicates whether the `Idempotency-Key` replayed.
- Errors: `400` invalid context, `404` missing cart, `422` validation failure, `409` concurrency conflict.

### Update Item Quantity
`PATCH /api/cart/items/:sku`

Body supports:
```jsonc
{
  "qty": 3,        // sets absolute quantity
  "delta": 1,      // or relative change
  "variantId": "variant-1",
  "selectedOptions": { "size": "L" }
}
```

Returns `200 OK` with the updated cart. Same error model as Add Item.

### Remove Item
`DELETE /api/cart/items/:sku`

- Optional body to disambiguate by variant/options:
```json
{ "variantId": "variant-1", "selectedOptions": { "size": "M" } }
```
- Returns `200 OK` with resulting cart.

### Merge Carts
`POST /api/cart/merge`

| Requirement | Description |
| --- | --- |
| `Authorization` | Required authenticated user. |
| `X-Cart-Id` | Required anonymous cart to merge. |
| `Idempotency-Key` | Required. |

Returns the merged user cart (`200 OK`). Errors: `400` when headers missing.

### Checkout
`POST /api/cart/checkout`

- Optional body (future extension for additional command data).
- Requires `Authorization` or `X-Cart-Id`.
- Requires `Idempotency-Key`.
- Response `200 OK` with:
```json
{
  "snapshot": { /* signed CartSnapshot, includes items, totals, signature */ },
  "orderId": "uuid | null"
}
```
- `orderId` is present when downstream `OrdersClient` successfully created an order; otherwise clients can retry using the returned snapshot.
- Stores idempotent responses keyed by user/cart scope.

Errors: `400` empty cart / invalid context, `409` concurrency, `422` pricing issues, `500` unexpected.

## Error Reference
| HTTP | Body | Description |
| --- | --- | --- |
| `400` | `{ error: "Provide X-Cart-Id or Authorization" }` | Missing identifiers. |
| `401/403` | `{ error: "unauthorized/forbidden" }` | Invalid/missing JWT for user-specific merges. |
| `404` | `{ error: "Cart not found" }` | Cart/context not found. |
| `409` | `{ error: "Cart concurrency conflict" }` | Lost update detection. |
| `422` | `{ error: "Validation failed", details: ... }` | Body validation issues. |
| `500` | `{ error: "Unexpected error" }` | Unhandled exceptions. |
