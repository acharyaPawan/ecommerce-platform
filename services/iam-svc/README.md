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

## Global roles and scopes

IAM issues JWTs that contain globally recognized roles/scopes so other services can make coarse authorization decisions without calling back to IAM. Configure initial admin principals via the `IAM_ADMIN_EMAILS` environment variable (comma-separated list). Admins automatically receive the `admin` role, which currently maps to the `catalog:write`, `orders:write`, and `payments:write` scopes. All other users default to the `customer` role with no privileged scopes. Downstream services remain responsible for finer-grained policies and may still maintain their own ACL tables when necessary.
