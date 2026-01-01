# Inventory Service API

## Overview
The inventory service maintains on-hand quantities, reservations, and emits domain events used by downstream fulfillment systems. Read endpoints require authentication, while write endpoints are restricted to operators/admins with the `inventory:write` scope.

## Base URL
- Internal service URL: `http://inventory-svc:3003`
- REST prefix: `/api/inventory`

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness probe `{ service, status }`. |
| `GET` | `/healthz` | Health endpoint. |
| `GET` | `/readyz` | Readiness endpoint. |

## Authentication
| Action | Required Scope |
| --- | --- |
| GET `/api/inventory/:sku` | Authenticated user (any scope). |
| POST adjustments/reservations/commit/release | `inventory:write`. |

Tokens are issued by IAM and provided via `Authorization: Bearer <jwt>`.

## Endpoints

### Get Inventory Summary
`GET /api/inventory/:sku`

Response `200 OK`:
```json
{
  "sku": "SKU-123",
  "onHand": 42,
  "reserved": 5,
  "available": 37,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Errors: `400` missing SKU, `404` not found, `401/403` auth, `500` server error.

### Adjust Stock (Internal)
`POST /api/inventory/adjustments`

Headers: `Authorization` with `inventory:write`.

Body:
```jsonc
{
  "sku": "SKU-123",
  "delta": 10,               // positive or negative integer (cannot result in negative on-hand)
  "reason": "initial_load",
  "referenceId": "optional external id"
}
```

Responses:
- `200 OK` `{ "status": "applied", "summary": { ... } }`
- `200 OK` `{ "status": "duplicate" }` when deduped via `messageId` (reserved for worker use).
- Errors: `400/422/500`.

### Reserve Stock
`POST /api/inventory/reservations`

Body:
```jsonc
{
  "orderId": "uuid",
  "items": [{ "sku": "SKU-123", "qty": 2 }],
  "ttlSeconds": 900   // optional, max 24h
}
```

Responses:
- `201 Created` `{ "status": "reserved", "items": [...], "expiresAt": "timestamp|null" }`
- `400` `{ "status": "failed", "reason": "INVALID_ITEMS" }`
- `409` `{ "status": "failed", "reason": "INSUFFICIENT_STOCK", "insufficientItems": [...] }`
- `200` `{ "status": "duplicate" }` when the same message was replayed.

### Commit Reservation
`POST /api/inventory/reservations/:orderId/commit`

- Marks active reservations as committed, decrements `onHand`, and emits `StockCommitted` events.
- Responses: `200 { "status": "committed", "items": [...] }`, `202 { "status": "noop" }`, or `200 { "status": "duplicate" }`.

### Release Reservation
`POST /api/inventory/reservations/:orderId/release`

Body:
```json
{ "reason": "customer_canceled" }
```

- Sets reservation status to released, decrements `reserved`, and emits release events.
- Responses mirror commit endpoint but with `status: "released"` or `"expired"`.

### JSON Parsing
All mutation endpoints expect valid JSON. Empty bodies return `400` unless the endpoint explicitly marks the body optional (e.g., release reason defaults to validation error when missing).

## Error Reference
| HTTP | Body | Description |
| --- | --- | --- |
| `400` | `{ error: "SKU is required" }`, `{ status: "failed", reason: "INVALID_ITEMS" }` | Validation issues. |
| `401/403` | `{ error: "unauthorized/forbidden" }` | Missing/insufficient scopes. |
| `404` | `{ error: "SKU not found" }` | Summary missing. |
| `409` | `{ status: "failed", reason: "INSUFFICIENT_STOCK" }` | Reservation conflict. |
| `500` | `{ error: "Failed to ..." }` | Unexpected server error. |
