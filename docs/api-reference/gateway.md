# Gateway (BFF) API

## Overview
The gateway is the only externally exposed service. It terminates client requests behind the ingress, enforces coarse authentication/authorization, orchestrates downstream services, and normalizes errors. All routes share the `/api` prefix when published through the ingress (`https://{host}/api/...`).

## Base URL & Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/` | Service banner `{ service, status, environment }`. |
| `GET` | `/api/healthz` | Health probe. |
| `GET` | `/api/readyz` | Readiness check that fans out to every downstream `/healthz`. Returns `503` when any dependency is unavailable. |

## Authentication
- Uses IAM-issued JWTs. Provide `Authorization: Bearer <jwt>`.
- Gateway enforces audience/issuer and injects the user context into every downstream call.
- Some endpoints accept anonymous callers (e.g., catalog browsing), while write operations require scopes referenced below.

## Response Envelope
Most routes return raw downstream payloads. When the gateway orchestrates multiple services (e.g., `/checkout/summary`), it returns a composed object plus `warnings` describing degraded dependencies.

## Endpoint Catalog

### Catalog (public)
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/products` | Proxies to catalog list endpoint with query pass-through (`status`, `limit`, `cursor`, `q`). |
| `GET` | `/api/products/:id` | Proxies to catalog detail endpoint. |

### Cart (requires auth)
| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/cart` | Proxies `GET /api/cart`. Requires JWT; gateway forwards token + contextual headers. |
| `POST` | `/api/cart/items` | Adds an item. Body forwarded to cart service. Requires `Idempotency-Key`. |
| `PATCH` | `/api/cart/items/:itemId` | Updates quantity (uses SKU in downstream path). |
| `DELETE` | `/api/cart/items/:itemId` | Removes an item; returns downstream status. |

Errors from cart service (validation, concurrency, etc.) bubble up unchanged.

### Customer Experience
`GET /api/me/dashboard` (auth required)

Aggregates:
- Profile: `GET iam /me`
- Cart summary: `GET cart /cart`
- Recent orders: `GET ordersRead /orders?userId=:userId&limit=5`

Returns `206 Partial Content` when any dependency fails and includes warnings such as `"cart unavailable"`.

### Checkout
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/checkout/summary` | Auth required. Loads cart, inventory availability (`/availability`), and fulfillment shipping options, returning `{ cart, availability, shippingOptions }`. |
| `POST` | `/api/checkout` | Auth required. Requires `Idempotency-Key` header (name taken from `IDEMPOTENCY_HEADER` env, default `idempotency-key`). Forwards payload plus `userId`, locale, and currency to `orders` service. Returns `{ order: ... }` with `202` for accepted commands (even if downstream replied `200`). |

### Orders & Payments
| Method | Path | Required Scope | Description |
| --- | --- | --- | --- |
| `GET` | `/api/orders/:orderId` | User or `orders:write` | Reads an order via `ordersRead`. |
| `POST` | `/api/orders/:orderId/cancel` | `orders:write` | Proxies to Orders command endpoint, forwarding `Idempotency-Key`. |
| `POST` | `/api/payments/:paymentId/capture` | `payments:write` | Proxies to Payments service capture endpoint. |
| `GET` | `/api/orders/:orderId/view` | `orders:write` | Aggregates order, payment history, and fulfillment shipment with best-effort semantics, returning `warnings` when dependencies fail. |

### Status and Diagnostics
- `/api/readyz` returns per-service readiness (name + boolean). Use this to verify downstream connectivity.

## Headers & Tracing
- Gateway injects/propagates `X-Request-Id`, `traceparent`, locale, and currency. Clients may provide `X-Request-Id`; otherwise one is generated and echoed back.
- Idempotent write endpoints expose `x-idempotent-replay` when downstream services support it (e.g., cart, orders).

## Errors
- The gateway preserves downstream HTTP codes whenever possible.
- Composition routes downgrade to `206` with `warnings` describing degraded dependencies.
- Authentication failures respond with `401` (`{ error: "unauthorized" }`) or `403` when scopes are missing.
