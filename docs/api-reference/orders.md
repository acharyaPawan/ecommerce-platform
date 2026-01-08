# Orders Service API

## Overview
The orders service persists signed cart snapshots produced by the cart service, exposes order lookups for customers and operators, and allows privileged users to cancel orders. It is an internal service, but the gateway proxies select endpoints to clients.

## Base URL
- Internal service URL: `http://orders-svc:3005`
- REST prefixes: `/api/orders` (primary) and `/orders` (legacy alias exposed via gateway)

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness `{ service, status }`. |
| `GET` | `/healthz` | Health probe. |
| `GET` | `/readyz` | Readiness check. |

## Authentication
- `POST /api/orders`: internal command invoked by the gateway/cart; requires a valid JWT (any authenticated user) and a signed cart snapshot.
- `GET /api/orders/:orderId`: requires authentication. Customers can view their own orders; operators/admins (scope `orders:write`) can view any order.
- `POST /api/orders/:orderId/cancel`: requires `orders:write` scope.

## Order Representation
```jsonc
{
  "id": "uuid",
  "status": "pending|canceled|...",
  "currency": "USD",
  "userId": "user-123|null",
  "totals": { "itemCount": 2, "totalQuantity": 3, "subtotalCents": 7500, "currency": "USD" },
  "cartSnapshot": { /* complete CartSnapshot payload including signature */ },
  "cancellationReason": "string|null",
  "canceledAt": "2024-01-01T00:10:00.000Z|null",
  "createdAt": "2024-01-01T00:05:00.000Z",
  "updatedAt": "2024-01-01T00:05:00.000Z"
}
```

## Endpoints

### Create Order (Internal)
`POST /api/orders`

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <jwt>` |
| `Idempotency-Key` | Required unique key per checkout attempt. |

Body:
```json
{
  "cartSnapshot": {
    "snapshotId": "uuid",
    "cartId": "uuid",
    "cartVersion": 5,
    "currency": "USD",
    "items": [ /* cart items with unitPriceCents/title */ ],
    "totals": { "itemCount": 2, "totalQuantity": 3, "subtotalCents": 7500, "currency": "USD" },
    "createdAt": "2024-01-01T00:05:00.000Z",
    "userId": "user-123",
    "signature": "hex-hmac",
    "pricingSnapshot": { ... }
  }
}
```

The signature must be computed with the shared `CART_SNAPSHOT_SECRET`. Requests with invalid signatures receive `422` `{ "error": "Invalid snapshot payload" }`.

Responses:
- `201 Created` `{ "orderId": "uuid" }`
- `200 OK` with `x-idempotent-replay: true` when the same `Idempotency-Key` replays.
- `422` validation/signature failures, `500` server errors.

### Get Order
`GET /api/orders/:orderId`

- Returns the order JSON when found and authorized.
- `404` when unknown; `403` if customer tries to access another user’s order.

### Cancel Order
`POST /api/orders/:orderId/cancel`

Headers: `Authorization` with `orders:write`.

Optional body:
```json
{ "reason": "customer_request" }
```

Responses:
- `200 OK` `{ "status": "canceled", "order": { ... } }`
- `409 Conflict` `{ "error": "Order already finalized", "order": { ... } }`
- `404 Not Found`

## Events
- `orders.order_placed.v1` after order creation.
- `orders.order_canceled.v1` after cancellation.

## Notes
- The service exposes identical routes under `/orders/*` to match the gateway configuration.
- Order creation and cancellation emit outbox events that are published by the orders outbox worker.
