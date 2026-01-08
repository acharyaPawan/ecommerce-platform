# Ecommerce Admin Flow (Catalog + Inventory)

This doc explains how the admin UI drives catalog and inventory so products can be purchased later through the ecommerce frontend.

## Goal

1. Create or seed catalog products.
2. Push those SKUs into inventory with an initial on-hand quantity.
3. Verify availability in the admin dashboard.
4. Customers can now add items to cart and place orders (inventory will reserve/commit stock).

## Admin request flow

### Authentication

- The admin app uses Better Auth for login.
- Server actions fetch a token via `authClient.token()` and store it in a service auth context.
- Downstream calls to internal services attach `Authorization: Bearer <token>` automatically.

Key files:
- Token fetch: `apps/ecommerce-admin/lib/server/service-auth.ts`
- Token context: `apps/ecommerce-admin/lib/server/service-auth-context.ts`
- Service calls: `apps/ecommerce-admin/lib/server/service-client.ts`

### Catalog operations

- **Seed random products** (Catalog Seeder card)
  - Action: `seedRandomProductsAction` in `apps/ecommerce-admin/app/actions/catalog-actions.ts`
  - Calls: `createCatalogProduct` in `apps/ecommerce-admin/lib/server/catalog-client.ts`
  - Service: `catalog-svc` via `/api/catalog/products`

- **Create a single product** (Create Catalog Product card)
  - Action: `createCatalogProductAction` in `apps/ecommerce-admin/app/actions/catalog-actions.ts`
  - Service: `catalog-svc` via `/api/catalog/products`

### Inventory operations

- **Manual adjustments** (Adjust Stock card)
  - Action: `adjustInventoryAction` in `apps/ecommerce-admin/app/actions/inventory-actions.ts`
  - Service: `inventory-svc` via `/api/inventory/adjustments`
  - Effect: creates/updates inventory rows for the SKU

- **Bulk seed from catalog** (Inventory Seeder card)
  - Action: `seedInventoryFromCatalogAction` in `apps/ecommerce-admin/app/actions/inventory-actions.ts`
  - Reads catalog products, then calls inventory adjustments for each variant
  - Defaults to seeding published products with a fixed quantity per SKU
  - Optionally skips SKUs that already have on-hand or reserved stock

### Dashboard data

- The dashboard merges catalog variants with inventory summaries in `apps/ecommerce-admin/lib/server/dashboard-data.ts`.
- If a SKU has no inventory row yet, it is shown with zero on-hand until seeded or adjusted.

## What’s now covered (filled gaps)

- Admin can seed catalog products and push inventory to make SKUs orderable.
- Inventory actions now fetch and pass the auth token consistently, same as catalog actions.
- Inventory seeding reduces the need for manual per-SKU adjustments.

## Expected backend services

- `iam-svc` for authentication
- `catalog-svc` for product data
- `inventory-svc` for stock tracking
- `orders-svc` + `payments-svc` for checkout workflows (used by the frontend)

## Quick admin flow checklist

1. Log into ecommerce admin (IAM user with `admin` role).
2. Create or seed catalog products.
3. Run Inventory Seeder (or adjust SKUs manually).
4. Confirm inventory dashboard shows on-hand > 0.
5. Use ecommerce frontend to place orders; inventory reservations/commits should flow.
