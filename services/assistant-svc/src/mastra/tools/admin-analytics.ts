import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { AnalyticsClient } from "../../analytics/client.js";

export function createAdminAnalyticsTools(analyticsClient: AnalyticsClient) {
  const recommendationInspectionTool = createTool({
    id: "get-recommendation-inspection",
    description:
      "Fetch recommendation quality diagnostics including fallback rate, low-support rate, diversification rate, and sampled anchors.",
    inputSchema: z.object({
      lookbackDays: z.number().int().positive().max(365).optional(),
      sampleAnchorLimit: z.number().int().positive().max(25).optional(),
      recommendationLimit: z.number().int().positive().max(10).optional(),
    }),
    outputSchema: z.object({
      generatedAt: z.string(),
      lookbackDays: z.number(),
      sampleAnchorCount: z.number(),
      metrics: z.object({
        totalInteractions: z.number(),
        uniqueActors: z.number(),
        uniqueProducts: z.number(),
        recommendationCount: z.number(),
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
              source: z.string().optional(),
              selectionStage: z.string().optional(),
              rawBehaviorScore: z.number().nullable().optional(),
            })
          ),
        })
      ),
    }),
    execute: async (input) => {
      const snapshot = await analyticsClient.getRecommendationInspection(input);

      return {
        generatedAt: snapshot.generatedAt,
        lookbackDays: snapshot.lookbackDays,
        sampleAnchorCount: snapshot.sampleAnchorCount,
        metrics: {
          totalInteractions: snapshot.metrics.totalInteractions,
          uniqueActors: snapshot.metrics.uniqueActors,
          uniqueProducts: snapshot.metrics.uniqueProducts,
          recommendationCount: snapshot.metrics.recommendationCount,
          fallbackRate: snapshot.metrics.fallbackRate,
          lowSupportRate: snapshot.metrics.lowSupportRate,
          diversifiedRate: snapshot.metrics.diversifiedRate,
        },
        anchors: snapshot.anchors,
      };
    },
  });

  const categoryForecastTool = createTool({
    id: "get-category-forecast",
    description:
      "Fetch category demand forecasts and planning signals such as projected units, demand status, urgency, and safety buffers.",
    inputSchema: z.object({
      lookbackDays: z.number().int().positive().max(365).optional(),
      horizonDays: z.number().int().positive().max(90).optional(),
      limit: z.number().int().positive().max(20).optional(),
    }),
    outputSchema: z.object({
      generatedAt: z.string(),
      lookbackDays: z.number(),
      horizonDays: z.number(),
      categories: z.array(
        z.object({
          categoryId: z.string(),
          categoryName: z.string(),
          projectedUnits: z.number(),
          trendPct: z.number(),
          demandStatus: z.enum(["rising", "stable", "softening"]),
          riskLevel: z.enum(["low", "medium", "high"]),
          urgency: z.enum(["monitor", "watch", "act"]),
          planningUnits: z.number(),
          safetyBufferUnits: z.number(),
          narrative: z.string(),
        })
      ),
    }),
    execute: async (input) => {
      const snapshot = await analyticsClient.getCategoryForecasts(input);

      return {
        generatedAt: snapshot.generatedAt,
        lookbackDays: snapshot.lookbackDays,
        horizonDays: snapshot.horizonDays,
        categories: snapshot.categories.map((category) => ({
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          projectedUnits: category.projectedUnits,
          trendPct: category.trendPct,
          demandStatus: category.demandStatus,
          riskLevel: category.riskLevel,
          urgency: category.urgency,
          planningUnits: category.planningUnits,
          safetyBufferUnits: category.safetyBufferUnits,
          narrative: category.narrative,
        })),
      };
    },
  });

  const customerChurnTool = createTool({
    id: "get-customer-churn-snapshot",
    description:
      "Fetch the current churn-risk snapshot for customers including retention priorities, high-risk counts, and top at-risk customers.",
    inputSchema: z.object({
      limit: z.number().int().positive().max(25).optional(),
    }),
    outputSchema: z.object({
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
          churnScore: z.number(),
          churnBand: z.enum(["low", "medium", "high"]),
          retentionPriority: z.enum(["p1", "p2", "p3"]),
          valueBand: z.enum(["low", "mid", "high"]),
          categoryDriftBand: z.enum(["low", "medium", "high"]),
          drivers: z.array(z.string()),
          recommendation: z.string(),
        })
      ),
    }),
    execute: async (input) => {
      const snapshot = await analyticsClient.getCustomerChurnSnapshot(input);

      return {
        generatedAt: snapshot.generatedAt,
        customerCount: snapshot.customerCount,
        highRiskCount: snapshot.highRiskCount,
        highValueHighRiskCount: snapshot.highValueHighRiskCount,
        highDriftCount: snapshot.highDriftCount,
        averageScore: snapshot.averageScore,
        customers: snapshot.customers.map((customer) => ({
          userId: customer.userId,
          name: customer.name,
          email: customer.email,
          churnScore: customer.churnScore,
          churnBand: customer.churnBand,
          retentionPriority: customer.retentionPriority,
          valueBand: customer.valueBand,
          categoryDriftBand: customer.categoryDriftBand,
          drivers: customer.drivers,
          recommendation: customer.recommendation,
        })),
      };
    },
  });

  return {
    recommendationInspectionTool,
    categoryForecastTool,
    customerChurnTool,
  };
}
