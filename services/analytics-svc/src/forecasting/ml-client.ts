import { z } from "zod";

const mlForecastPointSchema = z.object({
  date: z.string(),
  units: z.number(),
});

const mlCategoryForecastSchema = z.object({
  category_id: z.string(),
  category_name: z.string(),
  total_observed_units: z.number(),
  avg_daily_units: z.number(),
  recent_window_units: z.number(),
  previous_window_units: z.number(),
  trend_pct: z.number(),
  projected_units: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  demand_status: z.enum(["rising", "stable", "softening"]),
  risk_level: z.enum(["high", "medium", "low"]),
  urgency: z.enum(["urgent", "watch", "stable"]),
  safety_buffer_units: z.number(),
  planning_units: z.number(),
  narrative: z.string(),
  history: z.array(mlForecastPointSchema),
  forecast: z.array(mlForecastPointSchema),
});

const mlCategoryForecastResponseSchema = z.object({
  generated_at: z.string(),
  horizon_days: z.number(),
  categories: z.array(mlCategoryForecastSchema),
});

export type MlCategoryForecastSeries = {
  categoryId: string;
  categoryName: string;
  series: Array<{ date: string; units: number }>;
};

export type AnalyticsCategoryDemandForecast = {
  categoryId: string;
  categoryName: string;
  totalObservedUnits: number;
  avgDailyUnits: number;
  recentWindowUnits: number;
  previousWindowUnits: number;
  trendPct: number;
  projectedUnits: number;
  confidence: "high" | "medium" | "low";
  demandStatus: "rising" | "stable" | "softening";
  riskLevel: "high" | "medium" | "low";
  urgency: "urgent" | "watch" | "stable";
  safetyBufferUnits: number;
  planningUnits: number;
  narrative: string;
  history: Array<{ date: string; units: number }>;
  forecast: Array<{ date: string; units: number }>;
};

export type MlCategoryForecastSnapshot = {
  generatedAt: string;
  horizonDays: number;
  categories: AnalyticsCategoryDemandForecast[];
};

export async function fetchCategoryForecastsFromMlService(input: {
  baseUrl: string;
  horizonDays: number;
  minHistoryDays?: number;
  categories: MlCategoryForecastSeries[];
}): Promise<MlCategoryForecastSnapshot> {
  const response = await fetch(`${input.baseUrl}/api/forecast/categories`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      horizon_days: input.horizonDays,
      min_history_days: input.minHistoryDays,
      categories: input.categories.map((category) => ({
        category_id: category.categoryId,
        category_name: category.categoryName,
        history: category.series,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`ml forecast request failed with status ${response.status}`);
  }

  const payload = mlCategoryForecastResponseSchema.parse(await response.json());
  return {
    generatedAt: payload.generated_at,
    horizonDays: payload.horizon_days,
    categories: payload.categories.map((category) => ({
      categoryId: category.category_id,
      categoryName: category.category_name,
      totalObservedUnits: category.total_observed_units,
      avgDailyUnits: category.avg_daily_units,
      recentWindowUnits: category.recent_window_units,
      previousWindowUnits: category.previous_window_units,
      trendPct: category.trend_pct,
      projectedUnits: category.projected_units,
      confidence: category.confidence,
      demandStatus: category.demand_status,
      riskLevel: category.risk_level,
      urgency: category.urgency,
      safetyBufferUnits: category.safety_buffer_units,
      planningUnits: category.planning_units,
      narrative: category.narrative,
      history: category.history,
      forecast: category.forecast,
    })),
  };
}
