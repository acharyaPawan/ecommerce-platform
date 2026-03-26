import type { AnalyticsServiceConfig } from "../config.js";

export async function checkMlServiceReadiness(
  config: Pick<AnalyticsServiceConfig, "mlServiceUrl">
): Promise<{
  ready: boolean;
  status: number | null;
}> {
  try {
    const response = await fetch(`${config.mlServiceUrl}/readyz`);
    return {
      ready: response.ok,
      status: response.status,
    };
  } catch {
    return {
      ready: false,
      status: null,
    };
  }
}
