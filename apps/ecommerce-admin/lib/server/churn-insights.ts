"use server"

import "server-only"

import { getCustomerChurnRiskSnapshot } from "@/lib/server/analytics-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"

export async function getChurnInspectorData() {
  return withServiceAuthFromRequest(async () =>
    getCustomerChurnRiskSnapshot({
      limit: 8,
    })
  )
}
