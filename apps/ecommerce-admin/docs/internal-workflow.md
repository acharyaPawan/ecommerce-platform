# Ecommerce Admin Internal Workflow

This document is scoped to `apps/ecommerce-admin` and describes the internal implementation used by its workflow, with emphasis on the add/create-product path.

If you meant a different app by "ecommerce-add", update this file path/name and the same structure can be reused.

## 1. Runtime shape

- Framework: Next.js App Router with server components + server actions.
- Main route: `app/page.tsx`.
- Main UI orchestrator: `components/inventory-dashboard.tsx`.
- Downstream APIs are called through shared service client wrappers, not directly from components.

## 2. Request and auth flow

1. Route guard executes in `apps/ecommerce-admin/_proxy.ts`.
2. `authClient.getSession()` is checked; unauthenticated users are redirected to `/auth/sign-in`.
3. Role check requires `admin` in `data.user.roles`, otherwise redirect.
4. On page render, `app/page.tsx` also checks session and redirects if missing.
5. Server actions obtain a bearer token via `getServiceAuthTokenFromRequest()` from `lib/server/service-auth.ts`.
6. The token is placed in async context (`withServiceAuthToken`) and injected into outbound service calls by `serviceFetch()` in `lib/server/service-client.ts`.

Important implementation detail:
- Token fetch is performed by calling `${BETTER_AUTH_URL}/api/auth/token` with the inbound cookie header.
- `serviceFetch()` skips `Authorization` only for `iam`; all other services receive `Bearer <token>` when available.

## 3. Page data workflow

Entry point: `apps/ecommerce-admin/app/page.tsx`

1. Parse query filters (`q`, `status`).
2. Call `getInventoryDashboardData()` from `lib/server/dashboard-data.ts`.
3. `getInventoryDashboardData()`:
   - Calls catalog list endpoint (`listCatalogProducts`) with limit 50.
   - Flattens products -> variants.
   - Calls inventory summaries in one batched request (`getInventorySummaries` -> `POST /api/inventory/summaries`).
   - Builds `InventoryListItem` view model, including low-stock flag.
   - Computes metrics: totals, low-stock count, sell-through risk.
4. Render dashboard cards/forms in `InventoryDashboard`.

Low-stock rule used in code:
- `lowStock = available <= max(onHand * 0.25, 25)`.

## 4. "Add product" workflow (create path)

UI form: `CatalogProductCreator` in `apps/ecommerce-admin/components/inventory-dashboard.tsx`
Action: `createCatalogProductAction` in `apps/ecommerce-admin/app/actions/catalog-actions.ts`
Client call: `createCatalogProduct` in `apps/ecommerce-admin/lib/server/catalog-client.ts`

### 4.1 Form inputs collected

- `title` (required)
- `brand` (optional)
- `status` (`draft|published|archived`, default `draft`)
- `description` (optional)
- `categories` (optional, format: `id:Name,id2:Name2`)
- `sku` (required)
- `price` (required, decimal string)
- `currency` (default `USD`)
- `attributes` (optional, format: `key:value,key2:value2`)

### 4.2 Validation + normalization

Inside `createCatalogProductAction`:
- Rejects missing title or SKU.
- Rejects non-numeric or `<= 0` price.
- Converts `price` dollars to cents via `Math.round(price * 100)`.
- Uppercases currency before persistence.
- Parses `categories` into objects `{ id, name }`.
- Parses `attributes` into variant attribute map.
- Creates one variant payload, always with `status: "active"`.

### 4.3 Service contract

`createCatalogProduct(payload)` performs:
- `POST /api/catalog/products` via `serviceFetch`.
- Adds `Idempotency-Key` header (`crypto.randomUUID()`) because `idempotency: true`.
- Uses `cache: "no-store"` and service timeout controls.

### 4.4 Post-submit behavior

- On success: returns `{ status: "success", message: "Product created.", productId }`.
- On failure: returns `{ status: "error", message }`.
- Always calls `revalidatePath("/")` on success to refresh dashboard data.

## 5. Adjacent workflows implemented in same surface

- Product update:
  - UI: `ProductUpdateForm`
  - Action: `updateCatalogProductAction`
  - Call: `PATCH /api/catalog/products/:productId` (idempotent)
- Catalog bulk seed:
  - Action: `seedRandomProductsAction`
  - Uses Faker to generate products and creates them one-by-one.
- Inventory adjust:
  - Action: `adjustInventoryAction`
  - `POST /api/inventory/adjustments`
- Reservation lifecycle:
  - Create: `POST /api/inventory/reservations`
  - Commit: `POST /api/inventory/reservations/:orderId/commit`
  - Release: `POST /api/inventory/reservations/:orderId/release`
- Inventory seeding from catalog:
  - Lists catalog products, then applies inventory adjustments per variant.
  - Optional `onlyMissing` skips SKUs with existing on-hand or reserved stock.

## 6. Error handling and action state model

- UI forms use `React.useActionState`.
- Action state shape is simple and consistent:
  - `status`: `idle | success | error`
  - `message`: optional human-readable message
  - Optional payload fields per action (`productId`, `processed`, `summary`, etc.).
- Service-level non-2xx responses become `ServiceRequestError` with parsed message if available.

Inventory logging policy:
- Missing SKU summaries (404-equivalent for individual SKUs) are expected in mixed/seeded datasets and logged as debug, not error.
- Non-404 inventory failures remain error-level and are rethrown.

## 7. Service routing and base paths

All outbound calls use `serviceFetch()` and service name mapping in `lib/server/service-client.ts`.

Default base path behavior:
- Most services: `/api/<service>`
- Override examples:
  - inventory -> `/api/inventory`
  - ordersRead -> `/api/orders/read`
  - paymentsRead -> `/api/payments/read`

## 8. Environment dependencies

Defined in `apps/ecommerce-admin/env/server.ts`:

- Required:
  - `BETTER_AUTH_URL`
- Optional per-service URL and timeout overrides:
  - `SERVICE_CATALOG_URL`, `SERVICE_CATALOG_TIMEOUT_MS`
  - `SERVICE_INVENTORY_URL`, `SERVICE_INVENTORY_TIMEOUT_MS`
  - And equivalents for IAM, cart, orders, payments, fulfillment.

Without overrides, defaults in `lib/server/service-client.ts` point to localhost service ports.
