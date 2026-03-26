import { describe, expect, it } from "vitest";
import {
  applyRecommendationGuardrails,
  buildCategoryDemandForecasts,
  buildCategoryDemandSeries,
  buildActorWeights,
  buildCollaborativeRecommendations,
  buildCohortActorScores,
  buildCustomerChurnRiskProfile,
  buildProductHistoryWeights,
  forecastCategoryDemandFromSeries,
  scoreRelatedProducts,
  summarizeRecommendationInspection,
  toRate,
} from "../../src/analytics/service.js";

describe("applyRecommendationGuardrails", () => {
  it("prefers broader actor support before sparse candidates", () => {
    const result = applyRecommendationGuardrails(
      [
        {
          productId: "prod_a",
          score: 12,
          supportingSignals: 6,
          strongestEventType: "view",
          contributingActors: 3,
        },
        {
          productId: "prod_b",
          score: 11,
          supportingSignals: 4,
          strongestEventType: "purchase",
          contributingActors: 2,
        },
        {
          productId: "prod_c",
          score: 20,
          supportingSignals: 2,
          strongestEventType: "purchase",
          contributingActors: 1,
        },
      ],
      2
    );

    expect(result.map((item) => item.productId)).toEqual(["prod_a", "prod_b"]);
    expect(result.every((item) => item.selectionStage !== "low_support_backfill")).toBe(true);
  });

  it("caps dominant event types during the first diversified pass", () => {
    const result = applyRecommendationGuardrails(
      [
        {
          productId: "prod_a",
          score: 20,
          supportingSignals: 8,
          strongestEventType: "view",
          contributingActors: 4,
        },
        {
          productId: "prod_b",
          score: 19,
          supportingSignals: 7,
          strongestEventType: "view",
          contributingActors: 4,
        },
        {
          productId: "prod_c",
          score: 18,
          supportingSignals: 6,
          strongestEventType: "view",
          contributingActors: 4,
        },
        {
          productId: "prod_d",
          score: 17,
          supportingSignals: 6,
          strongestEventType: "purchase",
          contributingActors: 3,
        },
      ],
      4
    );

    expect(result[0]?.selectionStage).toBe("primary_diversified");
    expect(result[1]?.selectionStage).toBe("primary_diversified");
    expect(result[2]?.productId).toBe("prod_d");
    expect(result[2]?.selectionStage).toBe("primary_diversified");
    expect(result[3]?.productId).toBe("prod_c");
    expect(result[3]?.selectionStage).toBe("primary_relaxed");
  });
});

describe("behavioral scoring helpers", () => {
  it("uses the strongest event per actor when building anchor weights", () => {
    const weights = buildActorWeights([
      {
        productId: "anchor",
        userId: "user_1",
        sessionId: null,
        eventType: "view",
        occurredAt: new Date("2026-03-19T00:00:00.000Z"),
      },
      {
        productId: "anchor",
        userId: "user_1",
        sessionId: null,
        eventType: "purchase",
        occurredAt: new Date("2026-03-19T00:01:00.000Z"),
      },
      {
        productId: "anchor",
        userId: null,
        sessionId: "sess_1",
        eventType: "click",
        occurredAt: new Date("2026-03-19T00:02:00.000Z"),
      },
    ]);

    expect(weights.get("u:user_1")).toBe(6);
    expect(weights.get("s:sess_1")).toBe(2);
  });

  it("keeps duplicate-heavy events from inflating contributing actor counts", () => {
    const actorWeights = new Map([
      ["u:user_1", 6],
      ["s:sess_1", 2],
    ] as const);

    const scored = scoreRelatedProducts(
      [
        {
          productId: "prod_a",
          userId: "user_1",
          sessionId: null,
          eventType: "view",
          occurredAt: new Date("2026-03-19T00:00:00.000Z"),
        },
        {
          productId: "prod_a",
          userId: "user_1",
          sessionId: null,
          eventType: "purchase",
          occurredAt: new Date("2026-03-19T00:01:00.000Z"),
        },
        {
          productId: "prod_a",
          userId: null,
          sessionId: "sess_1",
          eventType: "click",
          occurredAt: new Date("2026-03-19T00:02:00.000Z"),
        },
      ],
      actorWeights
    );

    expect(scored).toEqual([
      {
        productId: "prod_a",
        score: 46,
        supportingSignals: 3,
        strongestEventType: "purchase",
        contributingActors: 2,
      },
    ]);
  });

  it("marks sparse collaborative candidates as low-support backfill", () => {
    const recommendations = buildCollaborativeRecommendations(
      [
        {
          productId: "prod_sparse",
          score: 9,
          supportingSignals: 2,
          strongestEventType: "purchase",
          contributingActors: 1,
        },
      ],
      {
        basis: "personal_behavior",
        limit: 3,
        seedProductIds: ["seed_1", "seed_2"],
      }
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.diagnostics.selectionStage).toBe("low_support_backfill");
    expect(recommendations[0]?.diagnostics.actorThresholdPassed).toBe(false);
    expect(recommendations[0]?.diagnostics.fallbackUsed).toBe(false);
    expect(recommendations[0]?.explanation.seedProductIds).toEqual(["seed_1", "seed_2"]);
  });

  it("builds cohort scores from weighted history overlap", () => {
    const historyWeights = buildProductHistoryWeights([
      {
        productId: "seed_a",
        userId: "user_1",
        sessionId: null,
        eventType: "purchase",
        occurredAt: new Date("2026-03-19T00:00:00.000Z"),
      },
      {
        productId: "seed_b",
        userId: "user_1",
        sessionId: null,
        eventType: "view",
        occurredAt: new Date("2026-03-19T00:01:00.000Z"),
      },
    ]);

    const cohortScores = buildCohortActorScores(
      [
        {
          productId: "seed_a",
          userId: "user_2",
          sessionId: null,
          eventType: "cart_add",
          occurredAt: new Date("2026-03-19T00:02:00.000Z"),
        },
        {
          productId: "seed_b",
          userId: null,
          sessionId: "sess_2",
          eventType: "click",
          occurredAt: new Date("2026-03-19T00:03:00.000Z"),
        },
      ],
      historyWeights
    );

    expect(historyWeights.get("seed_a")).toBe(6);
    expect(historyWeights.get("seed_b")).toBe(1);
    expect(cohortScores.get("u:user_2")).toBe(24);
    expect(cohortScores.get("s:sess_2")).toBe(2);
  });
});

describe("rate helpers", () => {
  it("returns zero for empty denominators", () => {
    expect(toRate(4, 0)).toBe(0);
  });

  it("rounds rates to two decimals", () => {
    expect(toRate(1, 3)).toBe(33.33);
    expect(toRate(2, 3)).toBe(66.67);
  });
});

describe("inspection summarization", () => {
  it("returns stable zeroed metrics for sparse windows with no recommendations", () => {
    const metrics = summarizeRecommendationInspection({
      recentEvents: [
        {
          productId: "prod_lonely",
          userId: null,
          sessionId: "sess_1",
          eventType: "view",
          occurredAt: new Date("2026-03-19T00:00:00.000Z"),
        },
      ],
      anchors: [
        {
          productId: "prod_lonely",
          interactionCount: 1,
          recommendations: [],
        },
      ],
    });

    expect(metrics.totalInteractions).toBe(1);
    expect(metrics.uniqueActors).toBe(1);
    expect(metrics.uniqueProducts).toBe(1);
    expect(metrics.recommendationCount).toBe(0);
    expect(metrics.fallbackRate).toBe(0);
    expect(metrics.lowSupportRate).toBe(0);
    expect(metrics.diversifiedRate).toBe(0);
    expect(metrics.stageBreakdown).toEqual({
      primary_diversified: 0,
      primary_relaxed: 0,
      low_support_backfill: 0,
      popular_backfill: 0,
    });
  });

  it("captures fallback-heavy and mixed-stage recommendation windows accurately", () => {
    const metrics = summarizeRecommendationInspection({
      recentEvents: [
        {
          productId: "anchor_1",
          userId: "user_1",
          sessionId: null,
          eventType: "purchase",
          occurredAt: new Date("2026-03-19T00:00:00.000Z"),
        },
        {
          productId: "anchor_2",
          userId: null,
          sessionId: "sess_1",
          eventType: "view",
          occurredAt: new Date("2026-03-19T00:01:00.000Z"),
        },
        {
          productId: "anchor_2",
          userId: null,
          sessionId: "sess_2",
          eventType: "click",
          occurredAt: new Date("2026-03-19T00:02:00.000Z"),
        },
      ],
      anchors: [
        {
          productId: "anchor_1",
          interactionCount: 1,
          recommendations: [
            {
              productId: "prod_a",
              score: 12,
              supportingSignals: 4,
              strongestEventType: "purchase",
              explanation: {
                basis: "related_behavior",
                summary: "Recommended from shoppers who also engaged with the current product.",
                reasons: [],
                contributingActors: 3,
                anchorProductId: "anchor_1",
              },
              diagnostics: {
                source: "collaborative",
                selectionStage: "primary_diversified",
                rawBehaviorScore: 12,
                fallbackUsed: false,
                actorThresholdPassed: true,
                diversifiedBySignal: true,
                contributingActors: 3,
              },
            },
            {
              productId: "prod_b",
              score: 7,
              supportingSignals: 2,
              strongestEventType: "view",
              explanation: {
                basis: "popular_fallback",
                summary: "Recommended from recent storefront momentum.",
                reasons: [],
                contributingActors: 1,
              },
              diagnostics: {
                source: "popular_fallback",
                selectionStage: "popular_backfill",
                rawBehaviorScore: 7,
                fallbackUsed: true,
                actorThresholdPassed: false,
                diversifiedBySignal: false,
                contributingActors: 1,
              },
            },
          ],
        },
        {
          productId: "anchor_2",
          interactionCount: 2,
          recommendations: [
            {
              productId: "prod_c",
              score: 5,
              supportingSignals: 1,
              strongestEventType: "click",
              explanation: {
                basis: "personal_behavior",
                summary: "Recommended from your activity history and similar shopper behavior.",
                reasons: [],
                contributingActors: 1,
                seedProductIds: ["anchor_2"],
              },
              diagnostics: {
                source: "collaborative",
                selectionStage: "low_support_backfill",
                rawBehaviorScore: 5,
                fallbackUsed: false,
                actorThresholdPassed: false,
                diversifiedBySignal: false,
                contributingActors: 1,
              },
            },
          ],
        },
      ],
    });

    expect(metrics.totalInteractions).toBe(3);
    expect(metrics.uniqueUsers).toBe(1);
    expect(metrics.uniqueSessions).toBe(2);
    expect(metrics.uniqueActors).toBe(3);
    expect(metrics.uniqueProducts).toBe(2);
    expect(metrics.eventTypeBreakdown.purchase).toBe(1);
    expect(metrics.eventTypeBreakdown.view).toBe(1);
    expect(metrics.eventTypeBreakdown.click).toBe(1);
    expect(metrics.recommendationCount).toBe(3);
    expect(metrics.collaborativeCount).toBe(2);
    expect(metrics.fallbackCount).toBe(1);
    expect(metrics.lowSupportCount).toBe(2);
    expect(metrics.diversifiedCount).toBe(1);
    expect(metrics.fallbackRate).toBe(33.33);
    expect(metrics.lowSupportRate).toBe(66.67);
    expect(metrics.diversifiedRate).toBe(33.33);
    expect(metrics.stageBreakdown).toEqual({
      primary_diversified: 1,
      primary_relaxed: 0,
      low_support_backfill: 1,
      popular_backfill: 1,
    });
  });
});

describe("category forecasting", () => {
  it("builds dense category series for ml-service requests", () => {
    const today = new Date();
    const latestBucket = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const earliestBucket = new Date(latestBucket);
    earliestBucket.setUTCDate(latestBucket.getUTCDate() - 2);

    const series = buildCategoryDemandSeries(
      [
        {
          categoryId: "cat_home",
          categoryName: "Home",
          bucket: earliestBucket.toISOString().slice(0, 10),
          units: 2,
        },
        {
          categoryId: "cat_home",
          categoryName: "Home",
          bucket: latestBucket.toISOString().slice(0, 10),
          units: 5,
        },
      ],
      {
        lookbackDays: 3,
      }
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.categoryId).toBe("cat_home");
    expect(series[0]?.categoryName).toBe("Home");
    expect(series[0]?.series).toEqual([
      { date: earliestBucket.toISOString().slice(0, 10), units: 2 },
      { date: new Date(Date.UTC(latestBucket.getUTCFullYear(), latestBucket.getUTCMonth(), latestBucket.getUTCDate() - 1)).toISOString().slice(0, 10), units: 0 },
      { date: latestBucket.toISOString().slice(0, 10), units: 5 },
    ]);
  });

  it("forecasts upward demand from stronger recent windows", () => {
    const forecast = forecastCategoryDemandFromSeries(
      {
        categoryId: "cat_home",
        categoryName: "Home",
        series: [
          { date: "2026-03-01", units: 0 },
          { date: "2026-03-02", units: 1 },
          { date: "2026-03-03", units: 1 },
          { date: "2026-03-04", units: 2 },
          { date: "2026-03-05", units: 2 },
          { date: "2026-03-06", units: 2 },
          { date: "2026-03-07", units: 2 },
          { date: "2026-03-08", units: 3 },
          { date: "2026-03-09", units: 3 },
          { date: "2026-03-10", units: 4 },
          { date: "2026-03-11", units: 4 },
          { date: "2026-03-12", units: 4 },
          { date: "2026-03-13", units: 5 },
          { date: "2026-03-14", units: 5 },
        ],
      },
      { horizonDays: 14 }
    );

    expect(forecast.categoryId).toBe("cat_home");
    expect(forecast.recentWindowUnits).toBe(28);
    expect(forecast.previousWindowUnits).toBe(10);
    expect(forecast.trendPct).toBe(180);
    expect(forecast.projectedUnits).toBeGreaterThan(56);
    expect(forecast.confidence).toBe("high");
    expect(forecast.demandStatus).toBe("rising");
    expect(forecast.riskLevel).toBe("high");
    expect(forecast.urgency).toBe("urgent");
    expect(forecast.planningUnits).toBeGreaterThan(forecast.projectedUnits);
    expect(forecast.forecast).toHaveLength(14);
  });

  it("keeps sparse category histories at low confidence", () => {
    const forecasts = buildCategoryDemandForecasts(
      [
        {
          categoryId: "cat_wellness",
          categoryName: "Wellness",
          bucket: "2026-03-18",
          units: 2,
        },
        {
          categoryId: "cat_wellness",
          categoryName: "Wellness",
          bucket: "2026-03-19",
          units: 1,
        },
      ],
      {
        lookbackDays: 14,
        horizonDays: 7,
      }
    );

    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]?.totalObservedUnits).toBe(3);
    expect(forecasts[0]?.confidence).toBe("low");
    expect(forecasts[0]?.urgency).toBe("watch");
    expect(forecasts[0]?.history).toHaveLength(14);
    expect(forecasts[0]?.forecast).toHaveLength(7);
  });
});

describe("customer churn scoring", () => {
  it("assigns high churn risk to long-inactive shallow customers", () => {
    const profile = buildCustomerChurnRiskProfile({
      userId: "user_1",
      name: "Avery",
      email: "avery@example.com",
      confirmedOrders: 1,
      lifetimeValueCents: 4200,
      averageOrderValueCents: 4200,
      topCategoryId: "home",
      topCategoryName: "Home",
      topCategoryShare: 1,
      recentTopCategoryId: "wellness",
      recentTopCategoryName: "Wellness",
      recentTopCategoryShare: 1,
      categoryDriftScore: 1,
      lastConfirmedOrderAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      lastInteractionAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    expect(profile.churnBand).toBe("high");
    expect(profile.churnScore).toBeGreaterThanOrEqual(70);
    expect(profile.valueBand).toBe("low");
    expect(profile.topCategoryName).toBe("Home");
    expect(profile.categoryDriftBand).toBe("high");
    expect(profile.retentionPriority).toBe("p2");
    expect(profile.drivers.length).toBeGreaterThan(0);
    expect(profile.recommendation).toContain("win-back");
  });

  it("keeps engaged repeat customers in the low-risk band", () => {
    const profile = buildCustomerChurnRiskProfile({
      userId: "user_2",
      name: "Jordan",
      email: "jordan@example.com",
      confirmedOrders: 5,
      lifetimeValueCents: 85_000,
      averageOrderValueCents: 17_000,
      topCategoryId: "office",
      topCategoryName: "Office",
      topCategoryShare: 0.4,
      recentTopCategoryId: "office",
      recentTopCategoryName: "Office",
      recentTopCategoryShare: 0.45,
      categoryDriftScore: 0.05,
      lastConfirmedOrderAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      lastInteractionAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    expect(profile.churnBand).toBe("low");
    expect(profile.churnScore).toBeLessThan(40);
    expect(profile.valueBand).toBe("high");
    expect(profile.categoryDriftBand).toBe("low");
    expect(profile.retentionPriority).toBe("p3");
    expect(profile.recommendation).toContain("healthy");
  });

  it("escalates high-value high-risk customers to top retention priority", () => {
    const profile = buildCustomerChurnRiskProfile({
      userId: "user_3",
      name: "Taylor",
      email: "taylor@example.com",
      confirmedOrders: 4,
      lifetimeValueCents: 80_000,
      averageOrderValueCents: 20_000,
      topCategoryId: "office",
      topCategoryName: "Office",
      topCategoryShare: 0.6,
      recentTopCategoryId: "wellness",
      recentTopCategoryName: "Wellness",
      recentTopCategoryShare: 1,
      categoryDriftScore: 0.9,
      lastConfirmedOrderAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
      lastInteractionAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    });

    expect(profile.churnBand).toBe("high");
    expect(profile.valueBand).toBe("high");
    expect(profile.retentionPriority).toBe("p1");
  });
});
