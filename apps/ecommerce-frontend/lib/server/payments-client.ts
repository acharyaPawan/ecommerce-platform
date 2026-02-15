"use server"

import "server-only"

import { ServiceRequestError, serviceFetch } from "@/lib/server/service-client"
import type { PaymentRecord } from "@/lib/types/payments"

type PaymentsListResponse = {
  items: PaymentRecord[]
}

export async function getPaymentsForOrder(
  orderId: string
): Promise<PaymentRecord[] | null> {
  if (!orderId) return []

  try {
    const response = await serviceFetch<PaymentsListResponse>({
      service: "payments",
      path: "/",
      searchParams: { orderId },
    })
    return response.items ?? []
  } catch (error) {
    if (error instanceof ServiceRequestError) {
      return null
    }
    throw error
  }
}
