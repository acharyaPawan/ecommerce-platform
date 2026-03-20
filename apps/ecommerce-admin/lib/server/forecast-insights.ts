"use server"

import "server-only"

import { getCategoryForecastSnapshot } from "@/lib/server/analytics-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"

export async function getForecastInspectorData() {
  return withServiceAuthFromRequest(async () =>
    getCategoryForecastSnapshot({
      lookbackDays: 60,
      horizonDays: 14,
      limit: 6,
    })
  )
}
