# IAM Service API

## Overview
The IAM service wraps [Better Auth](https://better-auth.dev) to provide authentication, session management, and issuance of JWTs that include global roles/scopes. It stores domain events in an outbox so other services can react to sign-ups, profile updates, and sign-outs.

## Base URL
- Internal service URL: `http://iam-svc:3001`
- REST prefix: `/api/auth/*` (Better Auth handler)

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness `{ service: "iam-svc", status: "ok" }`. |
| `GET` | `/healthz` | Health probe. |
| `GET` | `/readyz` | Readiness probe. |

## Authentication Tokens
- JWTs are signed via Better Auth’s EdDSA key pair and exposed through JWKS at `/api/auth/jwks`.
- Tokens include:
  - `userId`, `email`, `name`, `emailVerified`
  - `roles`: `customer`, `operator`, or `admin`
  - `scopes` derived from roles (`orders:write`, `payments:write`, `catalog:write`, `inventory:write`, etc.)
- Downstream services validate tokens using the JWKS endpoint or via the gateway.

## Core Endpoints
All routes live under `/api/auth/*` and follow Better Auth semantics. Notable handlers surfaced by this service:

| Route | Method(s) | Description |
| --- | --- | --- |
| `/api/auth/sign-up/email` | `POST` | Email/password registration. Triggers `UserRegisteredV1` and `AccessSynchronized` outbox events. |
| `/api/auth/sign-in/email` | `POST` | Email/password login. Issues session + JWT cookie. |
| `/api/auth/verify-email` | `POST` | Marks email as verified and emits `UserEmailVerifiedV1`. |
| `/api/auth/update-user` | `POST` | Allows authenticated users to update `name` and `image`. Emits `UserProfileUpdatedV1` when payload changes. |
| `/api/auth/sign-out` | `POST` | Revokes the active session and emits `UserSignedOutV1`. |
| `/api/auth/session` | `GET` | (Better Auth default) returns the enriched session (including roles/scopes). |
| `/api/auth/jwks` | `GET` | JWKS document for verifying JWTs. |

Additional default Better Auth routes (password reset, session refresh, etc.) remain available; consult Better Auth documentation for payload specifics.

## Global Roles & Scopes
| Role | Scopes | Description |
| --- | --- | --- |
| `customer` | _none_ | Default role assigned to all users. |
| `operator` | `orders:write`, `payments:write`, `inventory:write` | Intended for customer-support/operations tooling. |
| `admin` | `catalog:write`, `orders:write`, `payments:write`, `inventory:write` | Granted via `IAM_ADMIN_EMAILS` environment variable. |

Scopes are embedded into JWTs so downstream services can authorize requests without calling IAM.

## Hook Behavior
The service registers Better Auth hooks to:
- Synchronize roles/scopes into the session payload on every login.
- Persist IAM domain events (`UserRegistered`, `UserEmailVerified`, `UserProfileUpdated`, `UserSignedOut`) into `iam_outbox_events`.
- Propagate sign-out metadata so listeners can revoke downstream tokens.

## Response Contracts
- Successful auth endpoints return JSON matching Better Auth’s schema (`session`, `user`, etc.).
- Errors follow Better Auth conventions (e.g., `{ "error": "INVALID_CREDENTIALS" }` with relevant HTTP codes).

## Usage Notes
- Client applications should interact with IAM through the gateway or directly with `/api/auth/*` when running in internal environments.
- When seeding initial admins, set `IAM_ADMIN_EMAILS=alice@example.com,bob@example.com` and restart the service; their roles/scopes are synchronized automatically on next login.
