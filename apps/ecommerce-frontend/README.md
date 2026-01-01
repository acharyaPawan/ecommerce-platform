## Forma Supply Frontend

Next.js 16 storefront for the ecommerce platform. The app router is wired into feature modules so catalog/UI logic stays isolated from infra concerns.

### Run locally

```bash
pnpm install
pnpm dev
```

Environment flags:

- `DATABASE_URL` – optional Postgres connection for Drizzle powered reads/writes.
- `GATEWAY_BASE_URL` or `NEXT_PUBLIC_GATEWAY_BASE_URL` – base URL for cart mutations via the gateway service.

### Module layout

```
modules/
  catalog/
    components/{views,sections,layout,ui}
    lib/… (nuqs parsers, DTO mappers)
    server/
      query/{data,dsl,dto,service}
      mutation/…
  account/
    components/sections/…
    server/query/{data,dto,service}
    server/mutation/join-waitlist.ts
  cart/
    components/ui/add-to-cart-button.tsx
    server/mutation/add-to-cart.ts
```

Shared providers, HTTP clients, and Drizzle connectors live under `lib/`. Base UI primitives (buttons, cards, select, etc.) sit in `components/ui`.

### Database tooling

Drizzle powers the typed queries/mutations. Generate artifacts or push schema changes via:

```bash
pnpm db:generate
pnpm db:push
```

The `drizzle.config.ts` file scans `modules/**/server/query/data/*-schema.ts` so each feature can own its storage shape.
