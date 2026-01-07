import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { ServerType } from "@hono/node-server";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { user } from "../../src/db/schema";
import type { AppType } from "../../src/app";
import { applyMigrations, setupDockerTestDb, setupServer } from "./test-utils";

type AuthClient = typeof import("../../src/lib/auth-client")["authClient"];

describe("test user cleanup route", () => {
  const SERVER_PORT = 3211;
  const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

  let app: AppType;
  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let server: ServerType;
  let pgContainer: StartedPostgreSqlContainer;
  let authClient: AuthClient;
  let originalFetch: typeof fetch;
  let cookieJar: CookieJar;

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;
    process.env.BASE_URL = BASE_URL;
    process.env.BETTER_AUTH_URL = BASE_URL;
    vi.stubEnv('BETTER_AUTH_URL', BASE_URL)

    vi.resetModules();
    const dbModule = await import("../../src/db");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);

    ({ default: app } = await import("../../src/app"));
    server = await setupServer(app, SERVER_PORT);

    originalFetch = globalThis.fetch;
    cookieJar = new CookieJar();
    globalThis.fetch = createCookieFetch(originalFetch, cookieJar);

    ({ authClient } = await import("../../src/lib/auth-client"));
  }, 120_000);

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await server?.close();
    await pool?.end();
    await pgContainer?.stop();
  });

  it(
    "supports auth flows via authClient and cleans up deleted user records",
    async () => {
      const unique = createUniqueSuffix();
      const credentials = {
        name: `Test Runner ${unique}`,
        email: `test${unique}@example.org`,
        password: `runner-${unique}`,
        callbackURL: "",
        rememberMe: true,
      };

      const signUp = await authClient.signUp.email(credentials);
      expect(signUp.error).toBeNull();
      expect(signUp.data?.user.email).toBe(credentials.email);

      const tokenResult = await authClient.token();
      expect(tokenResult.error).toBeNull();
      expect(typeof tokenResult.data?.token).toBe("string");

      const signOutResult = await authClient.signOut();
      expect(signOutResult.error).toBeNull();

      const signIn = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: true,
      });
      expect(signIn.error).toBeNull();
      expect(signIn.data?.user.email).toBe(credentials.email);

      const deleteUser = await authClient.deleteUser();
      expect(deleteUser.error).toBeNull();

      const stored = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.email, credentials.email),
      });
      expect(stored).toBeUndefined();
    },
    90_000
  );

  it(
    "deletes users whose name or email matches the test-user rules",
    async () => {
      await cleanupTestUsers(BASE_URL);

      const unique = createUniqueSuffix();
      const controlUser = await createUser({
        name: `Real User ${unique}`,
        email: `real-${unique}@example.com`,
      });

      const nameOnlyUser = await createUser({
        name: `TestSubject ${unique}`,
        email: `subject-${unique}@example.net`,
      });
      const emailOnlyUser = await createUser({
        name: `Helper ${unique}`,
        email: `test${unique}@example.org`,
      });
      const nameAndEmailUser = await createUser({
        name: `TestCombo ${unique}`,
        email: `test${unique + 1}@example.org`,
      });

      const response = await fetch(`${BASE_URL}/testing/test-users`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
      const body: CleanupResponse = await response.json();
      expect(body.deletedCount).toBe(3);
      expect(new Set(body.deletedUserIds)).toEqual(
        new Set([nameOnlyUser, emailOnlyUser, nameAndEmailUser])
      );
      expect(body.deletedUserIds).not.toContain(controlUser);

      const remainingUsers = await db.query.user.findMany({
        columns: { id: true, email: true, name: true },
      });
      expect(remainingUsers).toHaveLength(1);
      expect(remainingUsers[0]?.id).toBe(controlUser);
    },
    90_000
  );

  async function createUser(data: { name: string; email: string }): Promise<string> {
    const payload = {
      name: data.name,
      email: data.email,
      password: `Pass-${createUniqueSuffix()}`,
      callbackURL: "",
      rememberMe: true,
    };
    const result = await authClient.signUp.email(payload);
    if (result.error || !result.data?.user.id) {
      throw new Error(`Failed to create user: ${result.error?.message ?? "unknown error"}`);
    }
    await authClient.signOut().catch(() => undefined);
    return result.data.user.id;
  }
});

type CleanupResponse = {
  deletedCount: number;
  deletedUserIds: string[];
};

function createUniqueSuffix(): number {
  return Number(String(Date.now()).slice(-6)) + Math.floor(Math.random() * 1000);
}

async function cleanupTestUsers(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/testing/test-users`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Failed to cleanup test users: ${response.status}`);
  }
}

class CookieJar {
  private store = new Map<string, Map<string, string>>();

  getCookieHeader(url: URL): string | undefined {
    const bucket = this.store.get(url.host);
    if (!bucket || bucket.size === 0) {
      return undefined;
    }
    return Array.from(bucket.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeFromResponse(url: URL, headers: Headers): void {
    for (const raw of getSetCookies(headers)) {
      this.storeCookie(url.host, raw);
    }
  }

  private storeCookie(host: string, raw: string): void {
    const [nameValue, ...attributes] = raw.split(";");
    const [name, ...valueParts] = nameValue.trim().split("=");
    if (!name) {
      return;
    }
    const value = valueParts.join("=") ?? "";
    const attrMap = attributes.reduce<Record<string, string>>((acc, attr) => {
      const [key, ...rest] = attr.trim().split("=");
      if (key) {
        acc[key.toLowerCase()] = rest.join("=") ?? "";
      }
      return acc;
    }, {});

    const targetBucket = this.store.get(host) ?? new Map<string, string>();
    const maxAge = attrMap["max-age"];
    const expires = attrMap["expires"];
    if (maxAge && Number(maxAge) <= 0) {
      targetBucket.delete(name);
    } else if (expires && Date.parse(expires) <= Date.now()) {
      targetBucket.delete(name);
    } else {
      targetBucket.set(name, value);
    }
    if (targetBucket.size > 0) {
      this.store.set(host, targetBucket);
    } else {
      this.store.delete(host);
    }
  }
}

function getSetCookies(headers: Headers): string[] {
  const experimental = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof experimental === "function") {
    return experimental.call(headers) ?? [];
  }
  const header = headers.get("set-cookie");
  return header ? [header] : [];
}

function createCookieFetch(target: typeof fetch, jar: CookieJar): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    const cookieHeader = jar.getCookieHeader(url);
    if (cookieHeader) {
      const existing = headers.get("cookie");
      headers.set("cookie", existing ? `${existing}; ${cookieHeader}` : cookieHeader);
    }

    const proxiedRequest = new Request(request, { headers });
    const response = await target(proxiedRequest);
    jar.storeFromResponse(url, response.headers);
    return response;
  };
}
