import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createApp } from "../../src/app.js";
import { createAnalyticsRouter } from "../../src/routes/analytics.js";
import type { AnalyticsServiceConfig } from "../../src/config.js";

const testConfig: AnalyticsServiceConfig = {
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

    const payload = await res.json() as { service: string; status: string };
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
    app.route(
      "/api/analytics",
      createAnalyticsRouter({ config: testConfig, recordInteraction })
    );

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
    expect(recordInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_1",
        eventType: "view",
        sessionId: "sess_1",
      })
    );
  });

  it("rejects interactions without a user or session actor", async () => {
    const recordInteraction = vi.fn();
    const app = new Hono();
    app.route(
      "/api/analytics",
      createAnalyticsRouter({ config: testConfig, recordInteraction })
    );

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

  it("returns a recommendation inspection snapshot", async () => {
    const getRecommendationInspection = vi.fn(async () => ({
      generatedAt: "2026-03-19T00:00:00.000Z",
      lookbackDays: 30,
      sampleAnchorCount: 1,
      metrics: {
        totalInteractions: 12,
        uniqueUsers: 2,
        uniqueSessions: 3,
        uniqueActors: 5,
        uniqueProducts: 4,
        eventTypeBreakdown: {
          view: 6,
          click: 2,
          wishlist_add: 1,
          cart_add: 1,
          purchase: 1,
          rating: 1,
          review: 0,
        },
        recommendationCount: 3,
        collaborativeCount: 2,
        fallbackCount: 1,
        lowSupportCount: 1,
        diversifiedCount: 2,
        fallbackRate: 33.33,
        lowSupportRate: 33.33,
        diversifiedRate: 66.67,
        stageBreakdown: {
          primary_diversified: 2,
          primary_relaxed: 0,
          low_support_backfill: 0,
          popular_backfill: 1,
        },
      },
      anchors: [
        {
          productId: "prod_1",
          interactionCount: 8,
          recommendations: [],
        },
      ],
    }));
    const app = new Hono();
    app.route(
      "/api/analytics",
      createAnalyticsRouter({ config: testConfig, getRecommendationInspection })
    );

    const res = await app.request("/api/analytics/recommendations/inspection");

    expect(res.status).toBe(200);
    expect(getRecommendationInspection).toHaveBeenCalled();
  });

  it("returns a category forecast snapshot", async () => {
    const getCategoryForecasts = vi.fn(async () => ({
      generatedAt: "2026-03-20T00:00:00.000Z",
      lookbackDays: 60,
      horizonDays: 14,
      categories: [
        {
          categoryId: "home",
          categoryName: "Home",
          totalObservedUnits: 24,
          avgDailyUnits: 1.2,
          recentWindowUnits: 10,
          previousWindowUnits: 7,
          trendPct: 42.86,
          projectedUnits: 20,
          confidence: "medium" as const,
          demandStatus: "rising" as const,
          riskLevel: "high" as const,
          urgency: "watch" as const,
          safetyBufferUnits: 5,
          planningUnits: 25,
          narrative: "Demand is accelerating. Plan for about 25 units including a 5-unit safety buffer.",
          history: [],
          forecast: [],
        },
      ],
    }));
    const app = new Hono();
    app.route(
      "/api/analytics",
      createAnalyticsRouter({ config: testConfig, getCategoryForecasts })
    );

    const res = await app.request("/api/analytics/forecasts/categories");

    expect(res.status).toBe(200);
    expect(getCategoryForecasts).toHaveBeenCalled();
  });

  it("returns a customer churn snapshot", async () => {
    const getCustomerChurnRisks = vi.fn(async () => ({
      generatedAt: "2026-03-21T00:00:00.000Z",
      customerCount: 1,
      highRiskCount: 1,
      highValueHighRiskCount: 0,
      highDriftCount: 1,
      averageScore: 82,
      customers: [
        {
          userId: "user_1",
          name: "Avery",
          email: "avery@example.com",
          confirmedOrders: 1,
          lifetimeValueCents: 4200,
          averageOrderValueCents: 4200,
          valueBand: "low" as const,
          topCategoryId: "home",
          topCategoryName: "Home",
          topCategoryShare: 1,
          recentTopCategoryId: "wellness",
          recentTopCategoryName: "Wellness",
          recentTopCategoryShare: 1,
          categoryDriftScore: 1,
          categoryDriftBand: "high" as const,
          retentionPriority: "p2" as const,
          lastConfirmedOrderAt: "2025-12-01T00:00:00.000Z",
          lastInteractionAt: "2026-01-01T00:00:00.000Z",
          daysSinceOrder: 110,
          daysSinceInteraction: 79,
          churnScore: 82,
          churnBand: "high" as const,
          drivers: ["No confirmed order in the last 90 days."],
          recommendation: "Prioritize a win-back touchpoint or retention offer.",
        },
      ],
    }));
    const app = new Hono();
    app.route(
      "/api/analytics",
      createAnalyticsRouter({ config: testConfig, getCustomerChurnRisks })
    );

    const res = await app.request("/api/analytics/churn/customers");

    expect(res.status).toBe(200);
    expect(getCustomerChurnRisks).toHaveBeenCalled();
  });
});
