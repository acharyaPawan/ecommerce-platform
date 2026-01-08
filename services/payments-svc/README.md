# Payments Service

The payments service tracks payment state for orders, exposes internal payment write endpoints, and emits payment events through an outbox publisher.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/payments/authorize` | Authorize payment for an order (requires `Idempotency-Key`). |
| `POST` | `/api/payments/:paymentId/fail` | Mark a payment failed. |
| `POST` | `/api/payments/:paymentId/capture` | Capture an authorized payment. |
| `GET` | `/api/payments?orderId=...` | List payments (optionally filtered by order). |

The same routes are also mounted under `/payments/*` for compatibility with the gateway defaults.

## Configuration

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required). |
| `PORT` | HTTP port (default `3007`). |
| `ORDER_EVENTS_EXCHANGE` | RabbitMQ exchange for `payments.*` events (default `orders.events`). |
| `ORDER_EVENTS_QUEUE` | RabbitMQ queue name for the outbox publisher (default `payments.events.publisher`). |
| `IAM_SERVICE_URL`, `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_DEV_USER_HEADER` | Standard auth settings consumed via `@ecommerce/core`. |

Run the service with:

```bash
pnpm --filter @ecommerce/payments-svc dev
```

Run the outbox publisher worker with:

```bash
pnpm --filter @ecommerce/payments-svc worker:outbox
```
