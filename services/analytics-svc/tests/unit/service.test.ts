import { describe, expect, it } from "vitest";
import {
  applyRecommendationGuardrails,
  buildActorWeights,
  buildCollaborativeRecommendations,
  buildCohortActorScores,
  buildProductHistoryWeights,
  scoreRelatedProducts,
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
