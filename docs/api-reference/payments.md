# Payments Service API

## Overview
The payments service tracks payment state for orders and emits payment events through an outbox publisher. It accepts any authorized request (no external processor) and exposes internal write endpoints for authorization/failure/capture plus a read endpoint used by the gateway.

## Base URL
- Internal service URL: `http://payments-svc:3007`
- REST prefix: `/api/payments`

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness probe. |
| `GET` | `/healthz` | Health probe. |
| `GET` | `/readyz` | Readiness probe. |

## Authentication
- All endpoints require a valid JWT.
- Mutating endpoints do not enforce role checks in this service; access is expected to be controlled by the gateway.

## Endpoints

### Authorize Payment (Internal)
`POST /api/payments/authorize`

Headers:
- `Authorization: Bearer <jwt>`
- `Idempotency-Key: <unique key>`

Body:
```json
{
  "orderId": "uuid",
  "amountCents": 7500,
  "currency": "USD"
}
```

Responses:
- `201 Created` `{ "paymentId": "uuid", "status": "authorized" }`
- `200 OK` with `x-idempotent-replay: true` when replayed
- `422` validation error

### Fail Payment
`POST /api/payments/:paymentId/fail`

Body (optional):
```json
{ "reason": "card_declined" }
```

Responses:
- `200 OK` `{ "status": "failed", "payment": { ... } }`
- `409 Conflict` `{ "error": "Payment already finalized", "payment": { ... } }`
- `404 Not Found`

### Capture Payment
`POST /api/payments/:paymentId/capture`

Responses:
- `200 OK` `{ "status": "captured", "payment": { ... } }`
- `409 Conflict` `{ "error": "Payment already finalized", "payment": { ... } }`
- `404 Not Found`

### List Payments
`GET /api/payments?orderId=uuid`

Response `200 OK`:
```json
{ "items": [ { "id": "uuid", "orderId": "uuid", "status": "authorized", "amountCents": 7500, "currency": "USD" } ] }
```

## Events
- `payments.payment_authorized.v1` after authorization.
- `payments.payment_failed.v1` after failure.
- `payments.payment_captured.v1` after capture.

Events are published to the `ORDER_EVENTS_EXCHANGE` exchange so inventory can consume `payments.*` alongside `orders.*`.
