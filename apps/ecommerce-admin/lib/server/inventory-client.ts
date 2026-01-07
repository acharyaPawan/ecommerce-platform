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

  try {
    return await serviceFetch<InventorySummary>({
      service: "inventory",
      path: `/inventory/${encodeURIComponent(sku)}`,
    })
  } catch (error) {
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
    path: "/inventory/adjustments",
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createInventoryReservation(
  payload: InventoryReservationPayload
): Promise<InventoryReservationResponse> {
  return serviceFetch<InventoryReservationResponse>({
    service: "inventory",
    path: "/inventory/reservations",
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function commitInventoryReservation(
  orderId: string
): Promise<ReservationMutationResponse> {
  return serviceFetch<ReservationMutationResponse>({
    service: "inventory",
    path: `/inventory/reservations/${encodeURIComponent(orderId)}/commit`,
    method: "POST",
  })
}

export async function releaseInventoryReservation(
  orderId: string,
  reason?: string
): Promise<ReservationMutationResponse> {
  return serviceFetch<ReservationMutationResponse>({
    service: "inventory",
    path: `/inventory/reservations/${encodeURIComponent(orderId)}/release`,
    method: "POST",
    body: reason ? JSON.stringify({ reason }) : undefined,
  })
}
