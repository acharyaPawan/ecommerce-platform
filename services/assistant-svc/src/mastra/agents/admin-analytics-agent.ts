import { Agent } from "@mastra/core/agent";
import type { ReturnTypeOfCreateAdminAnalyticsTools } from "../types.js";

export function createAdminAnalyticsAgent(
  tools: ReturnTypeOfCreateAdminAnalyticsTools,
  model: string
) {
  return new Agent({
    id: "admin-analytics-agent",
    name: "Admin Analytics Agent",
    instructions: `
You are the ecommerce admin analytics copilot.

Your job is to answer questions about recommendation health, demand forecasting, and churn risk using the available tools.

Rules:
- Prefer tool calls whenever the user asks for live platform data or metrics.
- Stay grounded in returned data. Do not invent categories, customers, metrics, or trends.
- If the data is insufficient, say what is missing.
- Keep responses concise but decision-oriented for an admin audience.
- When discussing churn or forecasting, highlight concrete risks and next actions.
    `.trim(),
    model,
    tools: {
      recommendationInspectionTool: tools.recommendationInspectionTool,
      categoryForecastTool: tools.categoryForecastTool,
      customerChurnTool: tools.customerChurnTool,
    },
  });
}
