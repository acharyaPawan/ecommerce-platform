import { z } from "zod";
import type { AssistantServiceConfig } from "../config.js";

const recommendationInspectionSchema = z.object({
  generatedAt: z.string(),
  lookbackDays: z.number(),
  sampleAnchorCount: z.number(),
  metrics: z.object({
    totalInteractions: z.number(),
    uniqueUsers: z.number(),
    uniqueSessions: z.number(),
    uniqueActors: z.number(),
    uniqueProducts: z.number(),
    recommendationCount: z.number(),
    collaborativeCount: z.number(),
    fallbackCount: z.number(),
    lowSupportCount: z.number(),
    diversifiedCount: z.number(),
    fallbackRate: z.number(),
    lowSupportRate: z.number(),
    diversifiedRate: z.number(),
  }),
  anchors: z.array(
    z.object({
      productId: z.string(),
      interactionCount: z.number(),
      recommendations: z.array(
        z.object({
          productId: z.string(),
          rawBehaviorScore: z.number().nullable().optional(),
          source: z.string().optional(),
          selectionStage: z.string().optional(),
        })
      ),
    })
  ),
});

const categoryForecastSchema = z.object({
  generatedAt: z.string(),
  lookbackDays: z.number(),
  horizonDays: z.number(),
  categories: z.array(
    z.object({
      categoryId: z.string(),
      categoryName: z.string(),
      totalObservedUnits: z.number(),
      avgDailyUnits: z.number(),
      recentWindowUnits: z.number(),
      previousWindowUnits: z.number(),
      trendPct: z.number(),
      projectedUnits: z.number(),
      confidence: z.enum(["low", "medium", "high"]),
      demandStatus: z.enum(["rising", "stable", "softening"]),
      riskLevel: z.enum(["low", "medium", "high"]),
      urgency: z.enum(["monitor", "watch", "act"]),
      safetyBufferUnits: z.number(),
      planningUnits: z.number(),
      narrative: z.string(),
    })
  ),
});

const churnSnapshotSchema = z.object({
  generatedAt: z.string(),
  customerCount: z.number(),
  highRiskCount: z.number(),
  highValueHighRiskCount: z.number(),
  highDriftCount: z.number(),
  averageScore: z.number(),
  customers: z.array(
    z.object({
      userId: z.string(),
      name: z.string().nullable(),
      email: z.string().email(),
      confirmedOrders: z.number(),
      lifetimeValueCents: z.number(),
      averageOrderValueCents: z.number(),
      valueBand: z.enum(["low", "mid", "high"]),
      topCategoryName: z.string().nullable(),
      topCategoryShare: z.number(),
      recentTopCategoryName: z.string().nullable(),
      recentTopCategoryShare: z.number(),
      categoryDriftScore: z.number(),
      categoryDriftBand: z.enum(["low", "medium", "high"]),
      retentionPriority: z.enum(["p1", "p2", "p3"]),
      lastConfirmedOrderAt: z.string().nullable(),
      lastInteractionAt: z.string().nullable(),
      daysSinceOrder: z.number().nullable(),
      daysSinceInteraction: z.number().nullable(),
      churnScore: z.number(),
      churnBand: z.enum(["low", "medium", "high"]),
      drivers: z.array(z.string()),
      recommendation: z.string(),
    })
  ),
});

export type RecommendationInspection = z.infer<typeof recommendationInspectionSchema>;
export type CategoryForecastSnapshot = z.infer<typeof categoryForecastSchema>;
export type CustomerChurnSnapshot = z.infer<typeof churnSnapshotSchema>;

export class AnalyticsClient {
  constructor(private readonly config: Pick<AssistantServiceConfig, "analyticsServiceUrl" | "internalServiceSecret">) {}

  async getRecommendationInspection(input: {
    lookbackDays?: number;
    sampleAnchorLimit?: number;
    recommendationLimit?: number;
  } = {}): Promise<RecommendationInspection> {
    const query = new URLSearchParams();
    appendNumber(query, "lookbackDays", input.lookbackDays);
    appendNumber(query, "sampleAnchorLimit", input.sampleAnchorLimit);
    appendNumber(query, "recommendationLimit", input.recommendationLimit);

    return this.fetchJson(
      `/api/analytics/recommendations/inspection${query.size ? `?${query.toString()}` : ""}`,
      recommendationInspectionSchema
    );
  }

  async getCategoryForecasts(input: {
    lookbackDays?: number;
    horizonDays?: number;
    limit?: number;
  } = {}): Promise<CategoryForecastSnapshot> {
    const query = new URLSearchParams();
    appendNumber(query, "lookbackDays", input.lookbackDays);
    appendNumber(query, "horizonDays", input.horizonDays);
    appendNumber(query, "limit", input.limit);

    return this.fetchJson(
      `/api/analytics/forecasts/categories${query.size ? `?${query.toString()}` : ""}`,
      categoryForecastSchema
    );
  }

  async getCustomerChurnSnapshot(input: { limit?: number } = {}): Promise<CustomerChurnSnapshot> {
    const query = new URLSearchParams();
    appendNumber(query, "limit", input.limit);

    return this.fetchJson(
      `/api/analytics/churn/customers${query.size ? `?${query.toString()}` : ""}`,
      churnSnapshotSchema
    );
  }

  private async fetchJson<T>(
    path: string,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const response = await fetch(`${this.config.analyticsServiceUrl}${path}`, {
      headers: {
        "x-internal-service-secret": this.config.internalServiceSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`analytics request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return schema.parse(payload);
  }
}

function appendNumber(query: URLSearchParams, key: string, value: number | undefined): void {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    query.set(key, String(Math.trunc(value)));
  }
}
