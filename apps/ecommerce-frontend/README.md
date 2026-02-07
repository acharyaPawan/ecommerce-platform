# Ecommerce Frontend (BFF)

Aurora Market is the customer-facing storefront for the ecommerce platform. It uses the Next.js app router and server actions to act as the backend-for-frontend gateway, calling catalog, cart, orders, and fulfillment services directly.

## Highlights

- Server actions for cart mutations and checkout
- Service client layer modeled after `ecommerce-admin`
- Catalog browsing, product detail, cart review, and checkout flow

## Environment

Set the service URLs as needed (defaults match local service ports):

- `BETTER_AUTH_URL`
- `SERVICE_CATALOG_URL`
- `SERVICE_CART_URL`
- `SERVICE_ORDERS_URL`
- `SERVICE_FULFILLMENT_URL`

## Development

```bash
pnpm dev --filter ecommerce-frontend
```
