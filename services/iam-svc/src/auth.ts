import { betterAuth } from "better-auth";
import type { HookEndpointContext } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { customSession, jwt, openAPI } from "better-auth/plugins";
import type { UserRole } from "@ecommerce/core";
import db from "./db/index.js";
import { iamOutboxEvents } from "./db/schema.js";
import {
  AnyIamEvent,
  IamEventType,
  makeIamEnvelope,
} from "./contracts/iam-events.js";

const SIGN_UP_EMAIL_PATH = "/sign-up/email";
const SIGN_IN_EMAIL_PATH = "/sign-in/email";
const EMAIL_VERIFICATION_PATH = "/verify-email"; //To check with better
const UPDATE_USER_PATH = "/update-user";
const SIGN_OUT_PATH = "/sign-out";
const SIGN_OUT_STATE_KEY = "__iamSignOutState";
const DEFAULT_ROLE: UserRole = "customer";
const ROLE_ORDER: readonly UserRole[] = ["admin", "customer"];

type SignOutState = {
  token: string;
  userId: string;
};

const JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "iam-svc";
const JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "ecommerce-clients";
const JWT_EXPIRATION = process.env.AUTH_JWT_EXPIRATION ?? "15m";

const persistOutboxEvent = async (event: AnyIamEvent) => {
  await db.insert(iamOutboxEvents).values(mapToOutboxEvent(event));
};


export const mapToOutboxEvent = (event: AnyIamEvent) => {
  return {
    id: event.id,
    type: event.type,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    occurredAt: new Date(event.occurredAt),
    payload: event.payload,
    correlationId: event.correlationId ?? null,
    causationId: event.causationId ?? null,
    status: "pending",
    error: null,
  }
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    openAPI(),  
    jwt({
      jwks: {
        keyPairConfig: {
          alg: "EdDSA",
          crv: "Ed25519",
        },
      },
      jwt: {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expirationTime: JWT_EXPIRATION,
        definePayload: async ({ user, session }) => {
          const roles = extractUserRoles(user);
          return {
            userId: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            sessionId: session.id,
            roles,
          };
        },
      },
    }),
    customSession(async ({ user: sessionUser, session }) => {
      const roles = extractUserRoles(sessionUser);

      return {
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          userId: session.userId,
        },
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.name,
          image: sessionUser.image,
          emailVerified: sessionUser.emailVerified,
          createdAt: sessionUser.createdAt,
          updatedAt: sessionUser.updatedAt,
          roles,
        },
      };
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_OUT_PATH) {
        return;
      }

      const sessionCookieName = ctx.context.authCookies.sessionToken.name;
      const token = await ctx.getSignedCookie(sessionCookieName, ctx.context.secret);
      if (!token) {
        return;
      }

      const existingSession = await db.query.session.findFirst({
        where: (sessions, { eq }) => eq(sessions.token, token),
        columns: { userId: true },
      });

      if (!existingSession) {
        return;
      }

      (ctx.context as typeof ctx.context & { [SIGN_OUT_STATE_KEY]?: SignOutState })[
        SIGN_OUT_STATE_KEY
      ] = {
        token,
        userId: existingSession.userId,
      };
    }),
    after: createAuthMiddleware(async (ctx) => {
      const correlationId = getHeaderValue(ctx.headers, "x-request-id");
      const requestPath = ctx.path;

      if (
        requestPath === SIGN_UP_EMAIL_PATH ||
        requestPath === SIGN_IN_EMAIL_PATH ||
        requestPath === EMAIL_VERIFICATION_PATH
      ) {
        const newSession = ctx.context.newSession;
        if (!newSession) {
          return;
        }

        const user = newSession.user as typeof newSession.user & {
          emailVerified?: boolean | null;
          name?: string | null;
        };

        if (requestPath === SIGN_UP_EMAIL_PATH) {
          const envelope = makeIamEnvelope({
            type: IamEventType.UserRegisteredV1,
            aggregateId: user.id,
            correlationId,
            payload: {
              userId: user.id,
              email: user.email,
              name: user.name ?? null,
              emailVerified: Boolean(user.emailVerified),
            },
          });

          await persistOutboxEvent(envelope);
          return;
        }

        if (requestPath === SIGN_IN_EMAIL_PATH) {
          const envelope = makeIamEnvelope({
            type: IamEventType.UserSignedInV1,
            aggregateId: user.id,
            correlationId,
            payload: {
              userId: user.id,
              occurredAt: new Date().toISOString(),
            },
          });

          await persistOutboxEvent(envelope);
          return;
        }

        if (requestPath === EMAIL_VERIFICATION_PATH) {
          const envelope = makeIamEnvelope({
            type: IamEventType.UserEmailVerifiedV1,
            aggregateId: user.id,
            correlationId,
            payload: {
              userId: user.id,
              verifiedAt: new Date().toISOString(),
            },
          });

          await persistOutboxEvent(envelope);
          return;
        }
      }

      if (requestPath === UPDATE_USER_PATH) {
        await handleProfileUpdatedEvent(ctx, correlationId);
        return;
      }

      if (requestPath === SIGN_OUT_PATH) {
        await handleSignedOutEvent(ctx, correlationId);
      }
    }),
  },
});

async function handleProfileUpdatedEvent(
  ctx: HookEndpointContext,
  correlationId?: string
): Promise<void> {
  const sessionContext = ctx.context.session;
  if (!sessionContext?.user?.id) {
    return;
  }

  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const payload: {
    userId: string;
    name?: string | null;
    avatarUrl?: string | null;
    updatedAt: string;
  } = {
    userId: sessionContext.user.id,
    updatedAt: new Date().toISOString(),
  };

  let hasUpdates = false;

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const value = body["name"];
    payload.name = (value ?? null) as string | null;
    hasUpdates = true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "image")) {
    const value = body["image"];
    payload.avatarUrl = (value ?? null) as string | null;
    hasUpdates = true;
  }

  if (!hasUpdates) {
    return;
  }

  const envelope = makeIamEnvelope({
    type: IamEventType.UserProfileUpdatedV1,
    aggregateId: sessionContext.user.id,
    correlationId,
    payload,
  });

  await persistOutboxEvent(envelope);
}

async function handleSignedOutEvent(
  ctx: HookEndpointContext,
  correlationId?: string
): Promise<void> {
  const authContext = ctx.context as typeof ctx.context & {
    [SIGN_OUT_STATE_KEY]?: SignOutState;
  };

  const state = authContext[SIGN_OUT_STATE_KEY];
  if (!state) {
    return;
  }

  delete authContext[SIGN_OUT_STATE_KEY];

  const envelope = makeIamEnvelope({
    type: IamEventType.UserSignedOutV1,
    aggregateId: state.userId,
    correlationId,
    payload: {
      userId: state.userId,
      occurredAt: new Date().toISOString(),
    },
  });

  await persistOutboxEvent(envelope);
}

function extractUserRoles(user: unknown): UserRole[] {
  if (!user || typeof user !== "object") {
    return [DEFAULT_ROLE];
  }
  const normalized = normalizeRoles((user as { roles?: unknown }).roles);
  if (normalized.length === 0) {
    return [DEFAULT_ROLE];
  }
  return normalized;
}

function normalizeRoles(value: unknown): UserRole[] {
  const values: string[] = Array.isArray(value)
    ? value.filter((role): role is string => typeof role === "string")
    : typeof value === "string"
      ? value
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean)
      : [];

  const allowed = values.filter(isUserRole);
  if (allowed.length > 0) {
    const seen = new Set<UserRole>();
    for (const role of ROLE_ORDER) {
      if (allowed.includes(role) && !seen.has(role)) {
        seen.add(role);
      }
    }
    for (const role of allowed) {
      if (!seen.has(role)) {
        seen.add(role);
      }
    }
    return Array.from(seen);
  }
  return [];
}

function isUserRole(value: string): value is UserRole {
  return value === "admin" || value === "customer";
}

function getHeaderValue(headers: Headers | HeadersInit | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  return new Headers(headers).get(name) ?? undefined;
}
