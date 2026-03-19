import { describe, expect, it } from "vitest";
import { applyRecommendationGuardrails } from "../../src/analytics/service.js";

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
