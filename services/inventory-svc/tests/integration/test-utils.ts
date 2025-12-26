import { serve, type ServerType } from "@hono/node-server";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { pushSchema } from "drizzle-kit/api";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { AppType } from "../../src/app";
import * as schema from "../../src/db/schema.js";

export async function setupDockerTestDb(): Promise<{
  container: StartedPostgreSqlContainer;
  connectionString: string;
}> {
  const POSTGRES_USER = "test";
  const POSTGRES_PASSWORD = "test";
  const POSTGRES_DB = "test";

  const container = await new PostgreSqlContainer("postgres:18.1-alpine")
    .withEnvironment({
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_DB,
    })
    .withExposedPorts(5432)
    .start();

  return { container, connectionString: container.getConnectionUri() };
}

export async function applyMigrations(db: typeof import("../../src/db").default): Promise<void> {
  await (await pushSchema(schema, db as any)).apply();
}

export async function setupServer(app: AppType, port?: number): Promise<ServerType> {
  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  const resolvedPort = port ?? envPort ?? 0;
  return serve({
    fetch: app.fetch,
    port: resolvedPort,
  });
}

export async function waitFor(
  predicate: () => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 50;
  const start = Date.now();

  return new Promise<void>((resolve, reject) => {
    const check = () => {
      try {
        if (predicate()) {
          resolve();
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Timed out waiting for condition"));
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });
}

export function randomQueueName(prefix: string): string {
  return `${prefix}.${randomUUID()}`;
}
