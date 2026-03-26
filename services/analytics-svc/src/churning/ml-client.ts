import { z } from "zod";

const mlCustomerChurnSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  confirmed_orders: z.number(),
  lifetime_value_cents: z.number(),
  average_order_value_cents: z.number(),
  value_band: z.enum(["high", "medium", "low"]),
  top_category_id: z.string().nullable(),
  top_category_name: z.string().nullable(),
  top_category_share: z.number(),
  recent_top_category_id: z.string().nullable(),
  recent_top_category_name: z.string().nullable(),
  recent_top_category_share: z.number(),
  category_drift_score: z.number(),
  category_drift_band: z.enum(["high", "medium", "low"]),
  retention_priority: z.enum(["p1", "p2", "p3"]),
  last_confirmed_order_at: z.string(),
  last_interaction_at: z.string().nullable(),
  days_since_order: z.number(),
  days_since_interaction: z.number().nullable(),
  churn_score: z.number(),
  churn_band: z.enum(["high", "medium", "low"]),
  drivers: z.array(z.string()),
  recommendation: z.string(),
});

const mlCustomerChurnResponseSchema = z.object({
  generated_at: z.string(),
  customers: z.array(mlCustomerChurnSchema),
});

export type MlCustomerChurnInput = {
  userId: string;
  name: string | null;
  email: string | null;
  confirmedOrders: number;
  lifetimeValueCents: number;
  averageOrderValueCents: number;
  topCategoryId: string | null;
  topCategoryName: string | null;
  topCategoryShare: number;
  recentTopCategoryId: string | null;
  recentTopCategoryName: string | null;
  recentTopCategoryShare: number;
  categoryDriftScore: number;
  daysSinceOrder: number;
  daysSinceInteraction: number | null;
  lastConfirmedOrderAt: string;
  lastInteractionAt: string | null;
};

export type AnalyticsCustomerChurnProfile = {
  userId: string;
  name: string | null;
  email: string | null;
  confirmedOrders: number;
  lifetimeValueCents: number;
  averageOrderValueCents: number;
  valueBand: "high" | "medium" | "low";
  topCategoryId: string | null;
  topCategoryName: string | null;
  topCategoryShare: number;
  recentTopCategoryId: string | null;
  recentTopCategoryName: string | null;
  recentTopCategoryShare: number;
  categoryDriftScore: number;
  categoryDriftBand: "high" | "medium" | "low";
  retentionPriority: "p1" | "p2" | "p3";
  lastConfirmedOrderAt: string;
  lastInteractionAt: string | null;
  daysSinceOrder: number;
  daysSinceInteraction: number | null;
  churnScore: number;
  churnBand: "high" | "medium" | "low";
  drivers: string[];
  recommendation: string;
};

export async function fetchCustomerChurnFromMlService(input: {
  baseUrl: string;
  customers: MlCustomerChurnInput[];
}): Promise<{
  generatedAt: string;
  customers: AnalyticsCustomerChurnProfile[];
}> {
  const response = await fetch(`${input.baseUrl}/api/churn/customers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      customers: input.customers.map((customer) => ({
        user_id: customer.userId,
        name: customer.name,
        email: customer.email,
        confirmed_orders: customer.confirmedOrders,
        lifetime_value_cents: customer.lifetimeValueCents,
        average_order_value_cents: customer.averageOrderValueCents,
        top_category_id: customer.topCategoryId,
        top_category_name: customer.topCategoryName,
        top_category_share: customer.topCategoryShare,
        recent_top_category_id: customer.recentTopCategoryId,
        recent_top_category_name: customer.recentTopCategoryName,
        recent_top_category_share: customer.recentTopCategoryShare,
        category_drift_score: customer.categoryDriftScore,
        days_since_order: customer.daysSinceOrder,
        days_since_interaction: customer.daysSinceInteraction,
        last_confirmed_order_at: customer.lastConfirmedOrderAt,
        last_interaction_at: customer.lastInteractionAt,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`ml churn request failed with status ${response.status}`);
  }

  const payload = mlCustomerChurnResponseSchema.parse(await response.json());
  return {
    generatedAt: payload.generated_at,
    customers: payload.customers.map((customer) => ({
      userId: customer.user_id,
      name: customer.name,
      email: customer.email,
      confirmedOrders: customer.confirmed_orders,
      lifetimeValueCents: customer.lifetime_value_cents,
      averageOrderValueCents: customer.average_order_value_cents,
      valueBand: customer.value_band,
      topCategoryId: customer.top_category_id,
      topCategoryName: customer.top_category_name,
      topCategoryShare: customer.top_category_share,
      recentTopCategoryId: customer.recent_top_category_id,
      recentTopCategoryName: customer.recent_top_category_name,
      recentTopCategoryShare: customer.recent_top_category_share,
      categoryDriftScore: customer.category_drift_score,
      categoryDriftBand: customer.category_drift_band,
      retentionPriority: customer.retention_priority,
      lastConfirmedOrderAt: customer.last_confirmed_order_at,
      lastInteractionAt: customer.last_interaction_at,
      daysSinceOrder: customer.days_since_order,
      daysSinceInteraction: customer.days_since_interaction,
      churnScore: customer.churn_score,
      churnBand: customer.churn_band,
      drivers: customer.drivers,
      recommendation: customer.recommendation,
    })),
  };
}
