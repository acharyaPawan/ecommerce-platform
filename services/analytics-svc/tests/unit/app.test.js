import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createApp } from "../../src/app.js";
import { createAnalyticsRouter } from "../../src/routes/analytics.js";
const testConfig = {
    serviceName: "analytics-svc",
    port: 3010,
    internalServiceSecret: "test-internal-secret",
    auth: {
        issuer: "https://example.com",
        audience: "ecommerce",
        jwksUrl: "https://example.com/.well-known/jwks.json",
        devUserHeader: "x-user-id",
    },
};
describe("analytics-svc app", () => {
    it("returns ok from root endpoint", async () => {
        const app = createApp(testConfig);
        const res = await app.request("/");
        expect(res.status).toBe(200);
        const payload = await res.json();
        expect(payload.service).toBe("analytics-svc");
        expect(payload.status).toBe("ok");
    });
    it("records anonymous interaction events with a session id", async () => {
        const recordInteraction = vi.fn(async (input) => ({
            id: "evt_123",
            eventType: input.eventType,
            source: input.source,
            userId: input.userId ?? null,
            sessionId: input.sessionId ?? null,
            productId: input.productId,
            variantId: input.variantId ?? null,
            properties: input.properties ?? {},
            occurredAt: "2026-03-17T00:00:00.000Z",
            createdAt: "2026-03-17T00:00:00.000Z",
            idempotent: false,
        }));
        const app = new Hono();
        app.route("/api/analytics", createAnalyticsRouter({ config: testConfig, recordInteraction }));
        const res = await app.request("/api/analytics/interactions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                productId: "prod_1",
                eventType: "view",
                sessionId: "sess_1",
            }),
        });
        expect(res.status).toBe(201);
        expect(recordInteraction).toHaveBeenCalledWith(expect.objectContaining({
            productId: "prod_1",
            eventType: "view",
            sessionId: "sess_1",
        }));
    });
    it("rejects interactions without a user or session actor", async () => {
        const recordInteraction = vi.fn();
        const app = new Hono();
        app.route("/api/analytics", createAnalyticsRouter({ config: testConfig, recordInteraction }));
        const res = await app.request("/api/analytics/interactions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                productId: "prod_1",
                eventType: "view",
            }),
        });
        expect(res.status).toBe(422);
        expect(recordInteraction).not.toHaveBeenCalled();
    });
});
