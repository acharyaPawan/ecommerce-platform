"use server"

import "server-only"

import {
  ServiceRequestError,
  serviceFetch,
} from "@/lib/server/service-client"
import type {
  InventoryAdjustmentPayload,
  InventoryAdjustmentResponse,
  InventoryReservationPayload,
  InventoryReservationResponse,
  InventorySummary,
  ReservationMutationResponse,
} from "@/lib/types/inventory"

export async function getInventorySummary(
  sku: string
): Promise<InventorySummary | null> {
  if (!sku) return null
console.log("In get InventorySummary.")
  try {
    return await serviceFetch<InventorySummary>({
      service: "inventory",
      path: `/${encodeURIComponent(sku)}`,
    })
  } catch (error) {
  console.log("Got error, i.e",error)
    if (error instanceof ServiceRequestError && error.status === 404) {
      return null
    }
    throw error
  }
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
