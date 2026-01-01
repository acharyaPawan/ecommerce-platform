# Gateway Service (BFF)

The gateway is the client-facing API layer that sits **behind** the Kubernetes ingress / NGINX stack. It owns composition and policy glue for customer/admin experiences, while the ingress controller continues to handle all edge concerns from the shared table:

| Concern | Owner | Notes |
| --- | --- | --- |
| TLS termination, HTTP→HTTPS redirect, host/path routing, compression, request size limits, DDoS protection, global rate limits | Ingress / NGINX | Centralized at the edge so every backend benefits. The gateway only receives already-vetted HTTPS traffic. |
| Fine-grained authN/Z, request/response shaping, per-user rate limits, aggregation and orchestration of backing services | Gateway (Node BFF) | Requires user/context awareness plus knowledge of downstream schemas. |
| Service-to-service retries/timeouts, circuit breaking | Ingress/mesh (platform) + gateway timeouts | Mesh enforces global policies; gateway still sets sensible per-call timeouts. |

## What the gateway does

1. **Normalize and secure every request**
   - Injects/propagates `X-Request-Id`, `traceparent`, locale, and currency defaults.
   - Verifies JWTs issued by IAM (Better Auth `jwt` plugin) using the IAM JWKS endpoint.
   - Applies coarse route-level authorization (scopes/roles) before touching downstream services.

2. **Expose stable client APIs**
   - Proxy endpoints: `/products`, `/cart/*`, `/auth/*` forward to single services but keep a consistent error contract.
   - Aggregation endpoints: `/me/dashboard`, `/checkout/summary`, `/orders/:id/view` fan out to IAM, Cart, Orders Read, Payments Read, etc., enforce timeouts, and return partial data with warnings when policy allows.
   - Command endpoints: `/checkout`, `/orders/:id/cancel`, `/payments/:id/capture` accept writes, forward idempotency headers, and return quickly (202) while domain workflows run elsewhere.

3. **Edge-adjacent policies that need business context**
   - Per-user/per-token rate limiting (future work) and request validation with Zod.
   - Idempotency enforcement for risky POSTs.
   - Uniform telemetry (structured logs, traces around downstream calls).

## How traffic flows today

```
Client ⇄ CDN ⇄ NGINX/Ingress (TLS, routing, global limits)
                      │
                      ▼
             Gateway (this service)
       ┌────────┬────────┬────────┬────────┐
       ▼        ▼        ▼        ▼        ▼
     IAM    Catalog    Cart    Orders    Payments …
```

- Ingress still owns TLS certs, redirects, host/path routing, gzip/brotli, request limits, and coarse deny rules. Its job is to forward `/api/*` traffic to the gateway service.
- The gateway receives only the traffic it cares about and focuses on API surface stability, auth, and composition. When a route is “pure proxy” (e.g., `/products`), it still adds auth headers, request IDs, and consistent errors—ingress does not rewrite payloads.
- Service mesh (once introduced) can add retries/circuit breaking; the gateway already sets per-service timeouts to avoid hanging requests.

## Configuration

- `IAM_SERVICE_URL` (default `http://localhost:3001`) tells the gateway where IAM runs. We auto-derive the JWKS endpoint as `${IAM_SERVICE_URL}/api/auth/jwks`, so enabling the Better Auth JWT plugin is enough for token issuance.
- `IAM_JWT_AUDIENCE` / `IAM_JWT_ISSUER` allow optional validation if IAM sets those values (see `services/iam-svc` env).
- Every downstream service URL + timeout is individually configurable via environment variables (see `src/config.ts`).

## what we are looking to do in future?

- Add per-user rate limiting backed by Redis for sensitive write endpoints.
- Expand aggregation routes as Orders/Payments read models evolve.
- Surface OpenAPI/Pact contracts for the gateway once the API surface stabilizes.
