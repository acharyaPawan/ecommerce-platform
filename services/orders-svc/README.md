# Orders Service

The orders service persists cart checkouts coming from the cart service, exposes an authenticated read surface for the gateway, and allows privileged operators to cancel orders. It validates every cart snapshot with the shared `CART_SNAPSHOT_SECRET` so only signed payloads from the cart service are accepted.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/orders` | Internal endpoint used by the cart service. Requires an `Idempotency-Key` header and a signed `cartSnapshot` payload. |
| `GET` | `/api/orders/:orderId` | Customer/operator lookup routed through the gateway. Requires authentication; customers can only access their own orders while admins (scope `orders:write`) can view any order. |
| `POST` | `/api/orders/:orderId/cancel` | Requires the `orders:write` scope. Marks an order as canceled and records an optional reason. |

The same routes are also mounted under `/orders/*` for compatibility with the gateway defaults.

## Configuration

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required). |
| `PORT` | HTTP port (default `3005`). |
| `CART_SNAPSHOT_SECRET` | Shared HMAC secret used to verify snapshots from the cart service (default `cart-snapshot-secret`). |
| `ORDER_RESERVATION_TTL_SECONDS` | Optional TTL passed to inventory reservation events. |
| `ORDER_EVENTS_EXCHANGE` | RabbitMQ exchange for `orders.*` events (default `orders.events`). |
| `ORDER_EVENTS_QUEUE` | RabbitMQ queue name for the outbox publisher (default `orders.events.publisher`). |
| `INVENTORY_EVENTS_EXCHANGE` | RabbitMQ exchange for inventory outcomes (default `inventory.events`). |
| `ORDERS_INVENTORY_EVENTS_QUEUE` | RabbitMQ queue used by the orders inventory consumer (default `orders.inventory-events`). |
| `IAM_SERVICE_URL`, `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_DEV_USER_HEADER` | Standard auth settings consumed via `@ecommerce/core`. |

Run the service with:

```bash
pnpm --filter @ecommerce/orders-svc dev
```

Run the outbox publisher worker with:

```bash
pnpm --filter @ecommerce/orders-svc worker:outbox
```

Run the inventory outcomes consumer with:

```bash
pnpm --filter @ecommerce/orders-svc worker:inventory
```
