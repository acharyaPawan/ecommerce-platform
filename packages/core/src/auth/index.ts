import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AuthConfig = {
  jwksUrl?: string;
  audience?: string;
  issuer?: string;
  devUserHeader?: string;
};

export type AuthenticatedUser = {
  userId: string;
  scopes: string[];
  roles: string[];
  expiresAt?: number;
  claims?: Record<string, unknown>;
  token?: string;
};

export type UserResolver = (request: Request) => Promise<AuthenticatedUser | null>;

export interface LoadAuthConfigOptions {
  env?: Record<string, string | undefined>;
  defaults?: Partial<AuthConfig>;
  deriveJwksFromIam?: {
    iamUrl?: string;
    jwksPath?: string;
  };
}

export const DEFAULT_DEV_USER_HEADER = "x-user-id";

export const loadAuthConfig = (options: LoadAuthConfigOptions = {}): AuthConfig => {
  const env = options.env ?? process.env;
  const read = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const envJwks = read(env.AUTH_JWKS_URL);
  const defaultJwks = options.defaults?.jwksUrl;
  const iamUrl = options.deriveJwksFromIam?.iamUrl ?? read(env.IAM_SERVICE_URL);
  const derivedJwks =
    !envJwks && iamUrl
      ? `${stripTrailingSlash(iamUrl)}${options.deriveJwksFromIam?.jwksPath ?? "/api/auth/jwks"}`
      : undefined;

  return {
    jwksUrl: envJwks ?? derivedJwks ?? defaultJwks,
    audience: read(env.AUTH_JWT_AUDIENCE) ?? options.defaults?.audience,
    issuer: read(env.AUTH_JWT_ISSUER) ?? options.defaults?.issuer,
    devUserHeader:
      read(env.AUTH_DEV_USER_HEADER) ?? options.defaults?.devUserHeader ?? DEFAULT_DEV_USER_HEADER,
  };
};

export interface UserResolverOptions {
  logger?: {
    warn: (message: string, metadata?: Record<string, unknown>) => void;
  };
}

export const createUserResolver = (
  config: AuthConfig,
  options: UserResolverOptions = {}
): UserResolver => {
  if (config.jwksUrl) {
    const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
    return async (request) => {
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
          audience: config.audience,
          issuer: config.issuer,
        });
        return toUser(token, verified.payload);
      } catch (error) {
        options.logger?.warn?.("auth.jwt.invalid", {
          message: (error as Error).message,
        });
        return null;
      }
    };
  }

  const header = config.devUserHeader ?? DEFAULT_DEV_USER_HEADER;
  options.logger?.warn?.("auth.dev-mode.enabled", { header });

  return async (request) => {
    const userId = request.headers.get(header);
    if (!userId) {
      return null;
    }
    const roles = request.headers.get(`${header}-roles`)?.split(" ").filter(Boolean) ?? [];
    const scopes = request.headers.get(`${header}-scopes`)?.split(" ").filter(Boolean) ?? [];
    return {
      userId: userId.trim(),
      scopes,
      roles,
    };
  };
};

export class AuthorizationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export const ensureAuthenticated = <T extends AuthenticatedUser | null | undefined>(
  user: T
): AuthenticatedUser => {
  if (!user) {
    throw new AuthorizationError("Authentication required", 401);
  }
  return user;
};

export const ensureScopes = (
  user: AuthenticatedUser | null | undefined,
  scopes: string[]
): void => {
  if (!scopes.length) {
    return;
  }
  const principal = ensureAuthenticated(user);
  const missing = scopes.filter((scope) => !principal.scopes.includes(scope));
  if (missing.length) {
    throw new AuthorizationError(`Missing scopes: ${missing.join(", ")}`, 403);
  }
};

export const ensureRoles = (user: AuthenticatedUser | null | undefined, roles: string[]): void => {
  if (!roles.length) {
    return;
  }
  const principal = ensureAuthenticated(user);
  const missing = roles.filter((role) => !principal.roles.includes(role));
  if (missing.length) {
    throw new AuthorizationError(`Missing roles: ${missing.join(", ")}`, 403);
  }
};

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

const stripTrailingSlash = (input: string): string =>
  input.endsWith("/") ? input.slice(0, -1) : input;
