import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import type { Pool } from "pg";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import type { ServerType } from "@hono/node-server";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import { IamEventType } from "../../src/contracts/iam-events";
import {
  applyMigrations,
  randomQueueName,
  setupDockerTestDb,
  setupServer,
  waitFor,
} from "./test-utils";
import { IamOutboxPublisherWorker } from "../../src/workers/iam-outbox-publisher";

type IamOutboxPublisherWorkerClass = typeof import("../../src/workers/iam-outbox-publisher").IamOutboxPublisherWorker;


describe("IAM events end-to-end flow", () => {
  const SERVER_PORT = 3102;
  const baseUrl = `http://127.0.0.1:${SERVER_PORT}`;

  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let server: ServerType;
  let app: typeof import("../../src/app").default;
  let pgContainer: Awaited<ReturnType<typeof setupDockerTestDb>>["container"];
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbitUrl: string;
  let workerPromise: Promise<void> | undefined;
  let IamOutboxPublisherWorker: IamOutboxPublisherWorkerClass;
  let worker: IamOutboxPublisherWorker

  let subscriberClient: RabbitMqClient;
  const receivedEvents: EventEnvelope<Record<string, unknown>>[] = [];
  let cursor = 0;

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;

    vi.resetModules();
    const dbModule = await import("../../src/db");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);
        ({ IamOutboxPublisherWorker } = await import("../../src/workers/iam-outbox-publisher"));

    ({ default: app } = await import("../../src/app"));
    server = await setupServer(app, SERVER_PORT);

    rabbitContainer = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    rabbitUrl = rabbitContainer.getAmqpUrl();

    const publisherClient = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: "iam.events.e2e",
      exchangeType: "topic",
      queue: randomQueueName("iam.events.publisher"),
      prefetch: 1,
    });
    worker = new IamOutboxPublisherWorker(publisherClient, {
      batchSize: 25,
      pollIntervalMs: 100,
    });
    workerPromise = worker.start();

    subscriberClient = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: "iam.events.e2e",
      exchangeType: "topic",
      queue: randomQueueName("iam.events.subscriber"),
      prefetch: 1,
    });
    await subscriberClient.subscribe({
      queue: randomQueueName("iam.events.subscriber.queue"),
      routingKey: "iam.#",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });
  }, 180_000);

  afterAll(async () => {
    await subscriberClient?.close();
    if (worker) {
      await worker.stop();
      await workerPromise;
    }
    await server?.close();
    await pool?.end();
    await pgContainer?.stop();
    await rabbitContainer?.stop();
  });

  it(
    "emits events for user lifecycle actions",
    async () => {
      const cookieJar = new CookieJar();
      const credentials = {
        name: "Event Tester",
        email: "events@example.com",
        password: "testing-123",
        image: "https://example.com/avatar.png",
        callbackURL: "",
        rememberMe: true,
      };

      const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      cookieJar.save(signUpResponse);
      expect(signUpResponse.status).toBe(200);
      const signUpBody = await signUpResponse.json();
      const userId: string = signUpBody.user.id;

      await expectNextEvent(IamEventType.UserRegisteredV1, (event) => {
        expect(event.payload.userId).toBe(userId);
        expect(event.payload.email).toBe(credentials.email);
      });

      const withCookies = (headers: Record<string, string>) => {
        const jarHeaders = cookieJar.header();
        return jarHeaders ? { ...headers, ...jarHeaders } : headers;
      };

      const signOutResponse = await fetch(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: withCookies({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      });
      cookieJar.save(signOutResponse);
      expect(signOutResponse.status).toBe(200);

      await expectNextEvent(IamEventType.UserSignedOutV1, (event) => {
        expect(event.payload.userId).toBe(userId);
      });

      const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: withCookies({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          rememberMe: true,
        }),
      });
      cookieJar.save(signInResponse);
      expect(signInResponse.status).toBe(200);

      await expectNextEvent(IamEventType.UserSignedInV1, (event) => {
        expect(event.payload.userId).toBe(userId);
      });

      const updatedName = "Updated Event Tester";
      const updatedImage = "https://example.com/avatar-2.png";
      const updateResponse = await fetch(`${baseUrl}/api/auth/update-user`, {
        method: "POST",
        headers: withCookies({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          name: updatedName,
          image: updatedImage,
        }),
      });
      cookieJar.save(updateResponse);
      expect(updateResponse.status).toBe(200);

      await expectNextEvent(IamEventType.UserProfileUpdatedV1, (event) => {
        expect(event.payload.userId).toBe(userId);
        expect(event.payload.name).toBe(updatedName);
        expect(event.payload.avatarUrl).toBe(updatedImage);
      });
    },
    180_000
  );

  async function expectNextEvent(
    type: IamEventType,
    assertFn?: (event: EventEnvelope<Record<string, unknown>>) => void
  ): Promise<void> {
    await waitFor(() => {
      return receivedEvents.slice(cursor).some((event) => event.type === type);
    }, { timeoutMs: 30_000 });
    const index = receivedEvents.findIndex((event, currentIndex) => currentIndex >= cursor && event.type === type);
    if (index === -1) {
      throw new Error(`Event ${type} not observed`);
    }
    cursor = index + 1;
    assertFn?.(receivedEvents[index]);
  }

  class CookieJar {
    private store = new Map<string, string>();

    save(response: Response): void {
      const setCookies = getSetCookies(response.headers);
      for (const item of setCookies) {
        this.storeCookie(item);
      }
    }

    header(): Record<string, string> | undefined {
      if (this.store.size === 0) {
        return undefined;
      }
      const cookieHeader = Array.from(this.store.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
      return { cookie: cookieHeader };
    }

    private storeCookie(raw: string): void {
      const parts = raw.split(";");
      const [nameValue, ...attributes] = parts;
      const [name, ...valueParts] = nameValue.trim().split("=");
      if (!name) {
        return;
      }
      const value = valueParts.join("=") ?? "";
      const attrMap = attributes.reduce<Record<string, string>>((acc, attr) => {
        const [key, ...val] = attr.trim().split("=");
        if (key) {
          acc[key.toLowerCase()] = val.join("=") ?? "";
        }
        return acc;
      }, {});

      const maxAge = attrMap["max-age"];
      const expires = attrMap["expires"];
      if (maxAge === "0" || (expires && Date.parse(expires) <= Date.now())) {
        this.store.delete(name);
        return;
      }

      this.store.set(name, value);
    }
  }
});

function getSetCookies(headers: Headers): string[] {
  if (typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }

  const header = headers.get("set-cookie");
  return header ? [header] : [];
}
