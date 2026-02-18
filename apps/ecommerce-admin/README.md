## Ecommerce Admin

Operational admin UI for catalog + inventory workflows in the ecommerce platform.

## Core docs

- Internal workflow details: `apps/ecommerce-admin/docs/internal-workflow.md`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key paths

- Page and dashboard UI: `apps/ecommerce-admin/app/page.tsx`, `apps/ecommerce-admin/components/inventory-dashboard.tsx`
- Server actions: `apps/ecommerce-admin/app/actions/catalog-actions.ts`, `apps/ecommerce-admin/app/actions/inventory-actions.ts`
- Service clients: `apps/ecommerce-admin/lib/server/catalog-client.ts`, `apps/ecommerce-admin/lib/server/inventory-client.ts`, `apps/ecommerce-admin/lib/server/service-client.ts`
- Auth and route protection: `apps/ecommerce-admin/_proxy.ts`, `apps/ecommerce-admin/lib/server/service-auth.ts`, `apps/ecommerce-admin/lib/server/auth-client.ts`

## Inventory fetch behavior

- Dashboard inventory reads are batched through `POST /api/inventory/summaries` (inventory service) to avoid one request per SKU.
- Missing inventory rows for some catalog SKUs are logged as debug (`inventory.summaries.partial` / `inventory.summary.missing`) instead of error in admin app logs.
- Dashboard media URLs are validated against allowed Next image hosts; unsupported/invalid URLs are dropped with structured logs (`dashboard.media.*`) instead of crashing selected-item rendering.
