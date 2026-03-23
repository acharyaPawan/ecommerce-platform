import { Mastra } from "@mastra/core/mastra";
import type { AssistantServiceConfig } from "../config.js";
import { AnalyticsClient } from "../analytics/client.js";
import { createAdminAnalyticsAgent } from "./agents/admin-analytics-agent.js";
import { createAdminAnalyticsTools } from "./tools/admin-analytics.js";

export function createMastra(config: AssistantServiceConfig) {
  const analyticsClient = new AnalyticsClient(config);
  const tools = createAdminAnalyticsTools(analyticsClient);
  const adminAnalyticsAgent = createAdminAnalyticsAgent(tools, config.assistantModel);

  return new Mastra({
    agents: {
      adminAnalyticsAgent,
    },
    logger: false,
  });
}
