# Fulfillment Service

This service currently provides a success-only fulfillment implementation.

## Endpoints

- `GET /api/fulfillment/shipping/options`: returns static shipping options for checkout.
- `GET /api/fulfillment/shipments?orderId=<id>`: returns a synthesized shipment in `fulfilled` status.
- `POST /api/fulfillment/shipments`: accepts `{ orderId }` and always returns a `fulfilled` shipment.

For compatibility with gateway defaults, both endpoints are also exposed at root:

- `GET /shipping/options`
- `GET /shipments?orderId=<id>`

## Run

```bash
pnpm --filter @ecommerce/fulfillment-svc dev
```
