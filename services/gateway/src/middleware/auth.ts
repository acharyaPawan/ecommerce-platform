import type { UserRole } from '@ecommerce/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createMiddleware } from 'hono/factory';
import type { GatewayConfig, AuthenticatedUser } from '../types.js';
import type { Logger } from '../logger.js';

export class AuthError extends Error {
  constructor(message: string, public readonly status: number = 401) {
    super(message);
  }
}

export interface AuthProvider {
  authenticate(request: Request): Promise<AuthenticatedUser | null>;
}

class JwtAuthProvider implements AuthProvider {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly options: {
      jwksUrl: string;
      audience?: string;
      issuer?: string;
      logger: Logger;
    },
  ) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  async authenticate(request: Request): Promise<AuthenticatedUser | null> {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) {
      return null;
    }

    const token = header.slice(7);

    try {
      const verified = await jwtVerify(token, this.jwks, {
        audience: this.options.audience,
        issuer: this.options.issuer,
      });

      return this.toPrincipal(token, verified.payload);
    } catch (error) {
      this.options.logger.warn(
        {
          err: error as Error,
        },
        'auth.jwt.invalid',
      );
      throw new AuthError('Invalid authentication token', 401);
    }
  }

  private toPrincipal(token: string, payload: JWTPayload): AuthenticatedUser {
    const roles = parseRoles(payload.roles);

    return {
      userId: payload.sub ?? '',
      roles,
      expiresAt: payload.exp,
      claims: payload as Record<string, unknown>,
      token,
    };
  }
}

class HeaderPassthroughAuthProvider implements AuthProvider {
  constructor(private readonly header: string) {}

  async authenticate(request: Request): Promise<AuthenticatedUser | null> {
    const userId = request.headers.get(this.header);
    if (!userId) {
      return null;
    }
    const roles = parseRoles(request.headers.get(`${this.header}-roles`));

    return {
      userId,
      roles,
    };
  }
}

export const createAuthProvider = (config: GatewayConfig, logger: Logger): AuthProvider => {
  if (config.auth.jwksUrl) {
    return new JwtAuthProvider({
      jwksUrl: config.auth.jwksUrl,
      audience: config.auth.audience,
      issuer: config.auth.issuer,
      logger,
    });
  }

  logger.warn(
    {
      header: config.auth.devUserHeader,
    },
    'auth.dev-mode.enabled',
  );
  return new HeaderPassthroughAuthProvider(config.auth.devUserHeader);
};

export const attachUser = (provider: AuthProvider) =>
  createMiddleware(async (c, next) => {
    try {
      const user = await provider.authenticate(c.req.raw);
      if (user) {
        c.set('user', user);
      }
    } catch (error) {
      c.set('authError', error as Error);
    }

    await next();
  });

interface AuthorizationOptions {
  roles?: UserRole[];
}

export const requireAuth = (options?: AuthorizationOptions) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      const err = c.get('authError');
      return c.json(
        {
          error: 'unauthorized',
          message: err?.message ?? 'Authentication required',
        },
        { status: 401 },
      );
    }

    if (options?.roles?.length) {
      const hasRoles = options.roles.every((role) => user.roles.includes(role));
      if (!hasRoles) {
        return c.json(
          {
            error: 'forbidden',
            message: 'Missing role',
          },
          { status: 403 },
        );
      }
    }

    return next();
  });

const parseRoles = (source: unknown): UserRole[] => {
  const raw: string[] = Array.isArray(source)
    ? source.filter((value): value is string => typeof value === 'string')
    : typeof source === 'string'
      ? source
          .split(' ')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  const normalized = raw.filter((value): value is UserRole => value === 'admin' || value === 'customer');
  return normalized.length ? Array.from(new Set(normalized)) : ['customer'];
};
