"use server"

import "server-only"

import { ServiceRequestError, serviceFetch } from "@/lib/server/service-client"
import type { OrderRecord } from "@/lib/types/orders"

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  if (!orderId) return null

  try {
    return await serviceFetch<OrderRecord>({
      service: "orders",
      path: `/${orderId}`,
    })
  } catch (error) {
    if (error instanceof ServiceRequestError && error.status === 404) {
      return null
    }
    throw error
  }
}
