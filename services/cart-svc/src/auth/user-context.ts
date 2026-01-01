import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { ServiceConfig } from "../config.js";

export type AuthenticatedUser = {
  userId: string;
  scopes: string[];
  roles: string[];
  expiresAt?: number;
  claims?: Record<string, unknown>;
  token?: string;
};

export type UserResolver = (request: Request) => Promise<AuthenticatedUser | null>;

const toUser = (token: string, payload: JWTPayload): AuthenticatedUser | null => {
  const subject = typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : undefined;
  const fallbackId =
    typeof payload.userId === "string" && payload.userId.length > 0
      ? (payload.userId as string)
      : undefined;
  const userId = subject ?? fallbackId;
  if (!userId) {
    return null;
  }

  const claims = payload as Record<string, unknown>;
  const arrayScopes = Array.isArray(claims.scopes) ? (claims.scopes as string[]) : undefined;
  const stringScopes =
    typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : undefined;
  const scopes = arrayScopes ?? stringScopes ?? [];

  const roles = Array.isArray(claims.roles) ? (claims.roles as string[]) : [];

  return {
    userId,
    scopes,
    roles,
    expiresAt: payload.exp,
    claims,
    token,
  };
};

export const createUserResolver = (config: ServiceConfig): UserResolver => {
  if (config.auth.jwksUrl) {
    const jwks = createRemoteJWKSet(new URL(config.auth.jwksUrl));
    return async (request: Request) => {
      const header = request.headers.get("authorization");
      if (!header?.toLowerCase().startsWith("bearer ")) {
        return null;
      }

      const token = header.slice(7).trim();
      if (!token) {
        return null;
      }

      try {
        const verified = await jwtVerify(token, jwks, {
          audience: config.auth.audience,
          issuer: config.auth.issuer,
        });
        return toUser(token, verified.payload);
      } catch (error) {
        console.warn("[cart-svc] auth.jwt.invalid", (error as Error).message);
        return null;
      }
    };
  }

  const header = config.auth.devUserHeader;
  console.warn("[cart-svc] auth dev mode enabled", { header });

  return async (request: Request) => {
    const userId = request.headers.get(header);
    if (!userId) {
      return null;
    }
    return {
      userId: userId.trim(),
      scopes: [],
      roles: [],
    };
  };
};
