"use server"

import "server-only"

import {
  ServiceRequestError,
  serviceFetch,
} from "@/lib/server/service-client"
import logger from "@/lib/server/logger"
import type {
  InventoryAdjustmentPayload,
  InventoryAdjustmentResponse,
  InventoryReservationPayload,
  InventoryReservationResponse,
  InventorySummary,
  InventorySummariesResponse,
  ReservationMutationResponse,
} from "@/lib/types/inventory"

export async function getInventorySummary(
  sku: string
): Promise<InventorySummary | null> {
  if (!sku) return null
  logger.debug({ sku }, "inventory.summary.requested")
  try {
    return await serviceFetch<InventorySummary>({
      service: "inventory",
      path: `/${encodeURIComponent(sku)}`,
    })
  } catch (error) {
    if (error instanceof ServiceRequestError && error.status === 404) {
      logger.debug({ sku }, "inventory.summary.missing")
      return null
    }
    logger.error({ err: error, sku }, "inventory.summary.failed")
    throw error
  }
}

export async function getInventorySummaries(
  skus: string[]
): Promise<Map<string, InventorySummary>> {
  const normalizedSkus = Array.from(
    new Set(skus.map((sku) => sku.trim().toUpperCase()).filter(Boolean))
  )
  if (normalizedSkus.length === 0) {
    return new Map()
  }

  const response = await serviceFetch<InventorySummariesResponse>({
    service: "inventory",
    path: "/summaries",
    method: "POST",
    body: JSON.stringify({ skus: normalizedSkus }),
  })

  if (response.missing.length > 0) {
    logger.debug(
      { requested: normalizedSkus.length, found: response.items.length, missing: response.missing.length },
      "inventory.summaries.partial"
    )
  } else {
    logger.debug({ count: response.items.length }, "inventory.summaries.loaded")
  }

  return new Map(
    response.items.map((summary) => [summary.sku.trim().toUpperCase(), summary] as const)
  )
}

export async function adjustInventory(
  payload: InventoryAdjustmentPayload
): Promise<InventoryAdjustmentResponse> {
  return serviceFetch<InventoryAdjustmentResponse>({
    service: "inventory",
    path: "/adjustments",
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createInventoryReservation(
  payload: InventoryReservationPayload
): Promise<InventoryReservationResponse> {
  return serviceFetch<InventoryReservationResponse>({
    service: "inventory",
    path: "/reservations",
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function commitInventoryReservation(
  orderId: string
): Promise<ReservationMutationResponse> {
  return serviceFetch<ReservationMutationResponse>({
    service: "inventory",
    path: `/reservations/${encodeURIComponent(orderId)}/commit`,
    method: "POST",
  })
}

export async function releaseInventoryReservation(
  orderId: string,
  reason?: string
): Promise<ReservationMutationResponse> {
  return serviceFetch<ReservationMutationResponse>({
    service: "inventory",
    path: `/reservations/${encodeURIComponent(orderId)}/release`,
    method: "POST",
    body: reason ? JSON.stringify({ reason }) : undefined,
  })
}
