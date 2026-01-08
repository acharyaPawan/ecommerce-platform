# Event-Driven Flows (Choreography Saga Overview)

This document maps the async messaging flows that exist in the repo today: who emits what, where outboxes live, which RabbitMQ exchanges/queues are used, and where services couple to each other.

## Shared conventions

- Envelope: events follow `EventEnvelope` from `packages/events/src/index.ts` with `id`, `type`, `occurredAt`, `aggregate`, optional `correlationId` and `causationId`, and `payload`.
- Broker: services use `@ecommerce/message-broker` (RabbitMQ wrapper) to publish and subscribe.
- Outbox: emitting services write domain events into an outbox table, and a worker publishes them to RabbitMQ and marks them published or failed.

## Service event map

### Catalog service (`services/catalog-svc`)

- Outbox table: `catalog.catalog_outbox_events` (`services/catalog-svc/src/db/schema.ts`).
- Publisher worker: `services/catalog-svc/src/workers/run-catalog-outbox-publisher.ts`.
  - Exchange: `CATALOG_EVENTS_EXCHANGE` (default `catalog.events`).
  - Queue: `CATALOG_EVENTS_QUEUE` (default `catalog.events.publisher`).
  - Routing key: event `type` (e.g., `catalog.product.created.v1`).
- Event types defined (`services/catalog-svc/src/catalog/events.ts`):
  - `catalog.product.created.v1`
  - `catalog.product.updated.v1`
  - `catalog.product.published.v1`
  - `catalog.product.unpublished.v1`
  - `catalog.product.archived.v1`
  - `catalog.variant.created.v1`
  - `catalog.variant.updated.v1`
  - `catalog.variant.discontinued.v1`
  - `catalog.price.changed.v1`
- Emission status:
  - `ProductCreatedV1` is emitted from `createProduct` (`services/catalog-svc/src/catalog/service.ts`).
  - The other event types are declared but do not have emitters in the repo yet.
- Consumers in repo: none.

### IAM service (`services/iam-svc`)

- Outbox table: `auth.iam_outbox_events` (`services/iam-svc/src/db/schema.ts`).
- Publisher worker: `services/iam-svc/src/workers/run-iam-outbox-publisher.ts`.
  - Exchange: `IAM_EVENTS_EXCHANGE` (default `iam.events`).
  - Queue: `IAM_EVENTS_QUEUE` (default `iam.events.publisher`).
- Event types (`services/iam-svc/src/contracts/iam-events.ts`), emitted via Better Auth hooks in `services/iam-svc/src/auth.ts`:
  - `iam.user.registered.v1` on `/sign-up/email`.
  - `iam.user.signed_in.v1` on `/sign-in/email`.
  - `iam.user.email_verified.v1` on `/verify-email`.
  - `iam.user.profile_updated.v1` on `/update-user` when name/image changed.
  - `iam.user.signed_out.v1` on `/sign-out`.
- AsyncAPI spec: `services/iam-svc/docs/asyncapi/iam.asyncapi.yml` documents channels `iam.events` and `iam.security-events`, but it currently lists Kafka as the transport. The runtime code publishes to RabbitMQ via a single exchange, so this spec and implementation should be reconciled.
- Consumers in repo: none.

### Inventory service (`services/inventory-svc`)

- Outbox table: `inventory.inventory_outbox_events` (`services/inventory-svc/src/db/schema.ts`).
- Publisher worker: `services/inventory-svc/src/workers/run-inventory-outbox-publisher.ts`.
  - Exchange: `INVENTORY_EVENTS_EXCHANGE` (default `inventory.events`).
  - Queue: `INVENTORY_EVENTS_QUEUE` (default `inventory.events.publisher`).
  - Routing key: event `type` (e.g., `inventory.stock.reserved.v1`).
- Event types (`services/inventory-svc/src/inventory/events.ts`), emitted inside `services/inventory-svc/src/inventory/service.ts`:
  - `inventory.stock.adjustment_applied.v1` when stock is adjusted.
  - `inventory.stock.reserved.v1` on successful reservation.
  - `inventory.stock.reservation_failed.v1` on invalid items or insufficient stock.
  - `inventory.stock.committed.v1` on commit.
  - `inventory.stock.reservation_released.v1` on explicit release.
  - `inventory.stock.reservation_expired.v1` on TTL expiry.
- Consumer: `OrderEventsConsumer` (`services/inventory-svc/src/workers/order-events-consumer.ts`).
  - Queue: `INVENTORY_ORDER_EVENTS_QUEUE` (default `inventory.order-events`).
  - Exchange: `ORDER_EVENTS_EXCHANGE` (required env, no default).
  - Routing keys: `orders.#` and `payments.#`.
  - Expected inbound event types (`services/inventory-svc/src/inventory/order-events.ts`):
    - `orders.order_placed.v1` -> `reserveStock`.
    - `payments.payment_authorized.v1` -> `commitReservation`.
    - `orders.order_canceled.v1` -> `releaseReservation`.
    - `payments.payment_failed.v1` -> `releaseReservation`.
  - Idempotency for inbound events uses `inventory.processed_messages`.

### Orders service (`services/orders-svc`)

- No outbox table or publisher worker in the repo.
- API docs explicitly state cancellation does not publish events (`docs/api-reference/orders.md`).
- The inventory consumer expects `orders.*` events; those publishers are not present here (likely a future or external component).

### Cart service (`services/cart-svc`)

- No outbox or messaging usage in the repo.
- Checkout uses synchronous HTTP to `orders-svc` (`services/cart-svc/src/clients/orders.ts`).

## Choreography saga: checkout + inventory (as implemented/expected)

1. Cart checkout sends a signed snapshot to Orders over HTTP (`/api/orders`).
2. Orders is expected to publish `orders.order_placed.v1` to the order events exchange (publisher not present in repo).
3. Inventory consumes `orders.order_placed.v1` and reserves stock, emitting `inventory.stock.reserved.v1` or `inventory.stock.reservation_failed.v1`.
4. Payments is expected to emit `payments.payment_authorized.v1` or `payments.payment_failed.v1` (publisher not present in repo).
5. Inventory consumes payment events to commit or release reservations and emits `inventory.stock.committed.v1` or `inventory.stock.reservation_released.v1`.
6. Downstream services (fulfillment, notifications, reporting) would subscribe to inventory events; none exist in this repo yet.

## Coupling points and where it clicks

- Event type strings are hard-coded in producers and consumers; renames must be coordinated.
- Exchanges and queues are service-specific and set via env vars; consumers assume routing keys (`orders.#`, `payments.#`) are used by upstream publishers.
- Outbox tables couple domain transaction boundaries to async messaging; publishing is decoupled via worker polling.
- Correlation and causation IDs are passed through when events originate from other events, but only some flows (inventory consumer, IAM hooks) populate them today.
- IAM AsyncAPI references Kafka, while code publishes to RabbitMQ; consumers should rely on the runtime behavior unless the spec is updated.
- Orders and Payments event publishers are missing from the repo; inventory flow assumes they exist.

## Gaps to verify or extend

- Catalog emits only `ProductCreatedV1` today; other event types are defined but unused.
- IAM docs mention an `AccessSynchronized` outbox event, but no such event exists in code.
- No consumers for catalog or inventory events are present; add them where read models or notifications are needed.
- `ORDER_EVENTS_EXCHANGE` has no default; deployments must supply it.
