import { describe, expect, it } from "vitest";
import {
  applyRecommendationGuardrails,
  buildActorWeights,
  buildCollaborativeRecommendations,
  buildCohortActorScores,
  buildProductHistoryWeights,
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
