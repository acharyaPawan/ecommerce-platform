# IAM Service

Authentication and authorization boundary built with Better Auth. The service exposes HTTP handlers via Hono and emits IAM domain events through an outbox table.

## Outbox Publisher Worker

The worker reads pending rows from `iam_outbox_events`, publishes integration events to RabbitMQ, and marks each row as published or failed. Configuration is provided via environment variables (defaults in parentheses):

| Variable | Description |
| --- | --- |
| `RABBITMQ_URL` (`amqp://ecommerce:ecommerce@localhost:5672`) | RabbitMQ connection string. |
| `IAM_EVENTS_EXCHANGE` (`iam.events`) | Exchange to publish IAM domain events to. |
| `IAM_EVENTS_QUEUE` (`iam.events.publisher`) | Queue used to initialize the AMQP channel (not consumed in this worker). |
| `IAM_OUTBOX_BATCH_SIZE` (`25`) | Maximum rows drained per polling iteration. |
| `IAM_OUTBOX_POLL_INTERVAL_MS` (`1000`) | Delay before polling again when no rows are pending. |

Run the worker with:

```bash
pnpm --filter @ecommerce/iam-svc worker:outbox
```

## Scripts

- `pnpm dev` – start the HTTP API with hot reload.
- `pnpm build` – type-check and emit JavaScript.
- `pnpm db:push` – apply the current Drizzle schema to the database.
- `pnpm worker:outbox` – run the IAM outbox publisher worker.
