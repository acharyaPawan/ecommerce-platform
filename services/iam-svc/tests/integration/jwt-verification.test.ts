import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { ServerType } from "@hono/node-server";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppType } from "../../src/app";
import { applyMigrations, setupDockerTestDb, setupServer } from "./test-utils";
import {
  setupAuthClientHarness,
  type AuthClient,
  type AuthClientHarness,
} from "./auth-client-helper";

describe("JWT verification using JWKS", () => {
  const SERVER_PORT = 3311;
  const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

  let app: AppType;
  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let server: ServerType;
  let pgContainer: StartedPostgreSqlContainer;
  let authClient: AuthClient;
  let harness: AuthClientHarness | undefined;

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;
    process.env.BASE_URL = BASE_URL;
    process.env.BETTER_AUTH_URL = BASE_URL;
    process.env.AUTH_JWT_ISSUER = BASE_URL;
    process.env.AUTH_JWT_AUDIENCE = BASE_URL;

    vi.resetModules();
    const dbModule = await import("../../src/db");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);

    ({ default: app } = await import("../../src/app"));
    server = await setupServer(app, SERVER_PORT);

    harness = await setupAuthClientHarness();
    authClient = harness.authClient;
  }, 120_000);

  afterAll(async () => {
    await fetch(`${BASE_URL}/testing/test-users`, { method: "DELETE" }).catch(() => undefined);
    harness?.restoreFetch();
    await server?.close();
    await pool?.end();
    await pgContainer?.stop();
  });

  it(
    "verifies issued tokens via remote JWKS",
    async () => {
      const unique = createUniqueSuffix();
      const credentials = {
        name: `Test JWKS ${unique}`,
        email: `test${unique}@example.org`,
        password: `jwks-${unique}`,
        callbackURL: "",
        rememberMe: true,
      };

      const signUp = await authClient.signUp.email(credentials);
      expect(signUp.error).toBeNull();
      const userId = signUp.data?.user.id;
      expect(typeof userId).toBe("string");

      const tokenResult = await authClient.token();
      expect(tokenResult.error).toBeNull();
      const token = tokenResult.data?.token;
      expect(typeof token).toBe("string");

      const JWKS = createRemoteJWKSet(new URL(`${BASE_URL}/api/auth/jwks`));
      const { payload } = await jwtVerify(token!, JWKS, {
        issuer: BASE_URL,
        audience: BASE_URL,
      });

      console.log('Got payload ', payload);
      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe(credentials.email);
      expect(payload.sessionId).toBeTruthy();
    },
    90_000
  );
});

function createUniqueSuffix(): number {
  return Number(String(Date.now()).slice(-6)) + Math.floor(Math.random() * 1000);
}
