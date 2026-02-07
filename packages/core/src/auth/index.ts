import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type UserRole = "customer" | "admin";

export type AuthConfig = {
  jwksUrl?: string;
  audience?: string;
  issuer?: string;
  devUserHeader?: string;
};

export type AuthenticatedUser = {
  userId: string;
  roles: UserRole[];
  expiresAt?: number;
  claims?: Record<string, unknown>;
  token?: string;
};

export type UserResolver = (request: Request) => Promise<AuthenticatedUser | null>;
const remoteJwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

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
    const jwks = getOrCreateRemoteJwks(config.jwksUrl);
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
    const roleHeader = request.headers.get(`${header}-roles`);
    const roles = parseRoles(roleHeader);
    return {
      userId: userId.trim(),
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

export const ensureRoles = (
  user: AuthenticatedUser | null | undefined,
  roles: UserRole[]
): void => {
  if (!roles.length) {
    return;
  }
  const principal = ensureAuthenticated(user);
  const missing = roles.filter((role) => !principal.roles.includes(role));
  if (missing.length) {
    throw new AuthorizationError(`Missing roles: ${missing.join(", ")}`, 403);
  }
};

export interface VerifyAuthTokenOptions {
  jwksUrl: string;
  issuer: string;
  audience?: string;
}

export type VerifiedAuthTokenPayload = {
  userId: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  sessionId: string;
  roles: UserRole[];
  token: string;
};

export const verifyAuthToken = async (
  token: string,
  options: VerifyAuthTokenOptions
): Promise<VerifiedAuthTokenPayload> => {
  const jwks = getOrCreateRemoteJwks(options.jwksUrl);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: options.issuer,
    ...(options.audience ? { audience: options.audience } : {}),
  });
  return mapPayloadToVerifiedToken(token, payload);
};

const getOrCreateRemoteJwks = (jwksUrl: string): ReturnType<typeof createRemoteJWKSet> => {
  const existing = remoteJwksCache.get(jwksUrl);
  if (existing) {
    return existing;
  }

  const created = createRemoteJWKSet(new URL(jwksUrl));
  remoteJwksCache.set(jwksUrl, created);
  return created;
};

export interface ReadBearerTokenOptions {
  optional?: boolean;
}

export const readBearerToken = (
  request: Request,
  options: ReadBearerTokenOptions = {}
): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.trim()) {
    if (options.optional) {
      return null;
    }
    throw new AuthorizationError("Authentication required", 401);
  }

  const normalized = header.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) {
    throw new AuthorizationError("Invalid Authorization header", 401);
  }

  const token = normalized.slice(7).trim();
  if (!token.length) {
    throw new AuthorizationError("Authentication required", 401);
  }
  return token;
};

export const resolveVerifyAuthTokenOptions = (config: AuthConfig): VerifyAuthTokenOptions => {
  const jwksUrl = config.jwksUrl?.trim();
  const issuer = config.issuer?.trim();
  const audience = config.audience?.trim();

  if (!jwksUrl || !issuer) {
    throw new Error("Auth config missing jwksUrl or issuer for JWT verification");
  }

  return {
    jwksUrl,
    issuer,
    ...(audience ? { audience } : {}),
  };
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
  const roles = parseRoles(claims.roles);
  const normalizedRoles = roles.length ? roles : (["customer"] satisfies UserRole[]);

  return {
    userId,
    roles: normalizedRoles,
    expiresAt: payload.exp,
    claims,
    token,
  };
};

const mapPayloadToVerifiedToken = (
  token: string,
  payload: JWTPayload
): VerifiedAuthTokenPayload => {
  const userId = resolveStringClaim(payload.userId) ?? resolveStringClaim(payload.sub);
  if (!userId) {
    throw new AuthorizationError("JWT payload missing userId/sub claim", 401);
  }
  const email = resolveStringClaim(payload.email);
  if (!email) {
    throw new AuthorizationError("JWT payload missing email claim", 401);
  }
  const sessionId = resolveStringClaim(payload.sessionId);
  if (!sessionId) {
    throw new AuthorizationError("JWT payload missing sessionId claim", 401);
  }
  const name = resolveOptionalString(payload.name);
  const roles = parseRoles(payload.roles);
  const normalizedRoles = roles.length ? roles : (["customer"] satisfies UserRole[]);

  return {
    userId,
    email,
    name,
    emailVerified: Boolean(payload.emailVerified),
    sessionId,
    roles: normalizedRoles,
    token,
  };
};

const stripTrailingSlash = (input: string): string =>
  input.endsWith("/") ? input.slice(0, -1) : input;

const parseRoles = (source: unknown): UserRole[] => {
  const rawRoles: string[] = Array.isArray(source)
    ? source.filter((value): value is string => typeof value === "string")
    : typeof source === "string"
      ? source
          .split(" ")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  const normalized = rawRoles.filter(isUserRole);
  return normalized.length ? Array.from(new Set(normalized)) : (["customer"] satisfies UserRole[]);
};

const isUserRole = (value: string): value is UserRole => value === "customer" || value === "admin";

const resolveStringClaim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const resolveOptionalString = (value: unknown): string | null => {
  const resolved = resolveStringClaim(value);
  return resolved ?? null;
};
