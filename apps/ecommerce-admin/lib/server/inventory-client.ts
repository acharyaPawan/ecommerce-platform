"use server"

import "server-only"

import {
  mockInventoryActivities,
  mockInventoryMetadata,
  mockInventorySummaries,
} from "@/lib/mock-data"
import type {
  InventoryAdjustmentPayload,
  InventoryAdjustmentResponse,
  InventoryReservationPayload,
  InventoryReservationResponse,
  InventoryReservationItem,
  InventorySummary,
  ReservationMutationResponse,
} from "@/lib/types/inventory"

type ReservationRecord = {
  payload: InventoryReservationPayload
  status: "reserved" | "committed" | "released"
  expiresAt?: string | null
}

const inventoryBaseUrl =
  process.env.INVENTORY_SERVICE_URL?.replace(/\/$/, "") ?? ""

const inventoryAuthHeader = process.env.INVENTORY_SERVICE_TOKEN
  ? { Authorization: `Bearer ${process.env.INVENTORY_SERVICE_TOKEN}` }
  : undefined

const mockSummaryStore = new Map<string, InventorySummary>(
  Object.entries(mockInventorySummaries).map(([sku, summary]) => [
    sku,
    { ...summary },
  ])
)

const mockReservationStore = new Map<string, ReservationRecord>()

export async function getInventorySummary(
  sku: string
): Promise<InventorySummary | null> {
  if (!sku) return null

  if (!inventoryBaseUrl) {
    return mockSummaryStore.get(sku) ?? null
  }

  const res = await fetch(`${inventoryBaseUrl}/${encodeURIComponent(sku)}`, {
    headers: {
      "Content-Type": "application/json",
      ...inventoryAuthHeader,
    },
    cache: "no-store",
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(
      `Failed to load inventory summary: ${res.status} ${res.statusText}`
    )
  }

  return (await res.json()) as InventorySummary
}

export async function adjustInventory(
  payload: InventoryAdjustmentPayload
): Promise<InventoryAdjustmentResponse> {
  if (!inventoryBaseUrl) {
    return adjustInMockStore(payload)
  }

  const res = await fetch(`${inventoryBaseUrl}/adjustments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...inventoryAuthHeader,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const message = await safeErrorMessage(res)
    throw new Error(message)
  }

  return (await res.json()) as InventoryAdjustmentResponse
}

export async function createInventoryReservation(
  payload: InventoryReservationPayload
): Promise<InventoryReservationResponse> {
  if (!inventoryBaseUrl) {
    return createMockReservation(payload)
  }

  const res = await fetch(`${inventoryBaseUrl}/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...inventoryAuthHeader,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const message = await safeErrorMessage(res)
    throw new Error(message)
  }

  return (await res.json()) as InventoryReservationResponse
}

export async function commitInventoryReservation(
  orderId: string
): Promise<ReservationMutationResponse> {
  if (!inventoryBaseUrl) {
    return commitMockReservation(orderId)
  }

  const res = await fetch(
    `${inventoryBaseUrl}/reservations/${encodeURIComponent(orderId)}/commit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...inventoryAuthHeader,
      },
    }
  )

  if (!res.ok) {
    const message = await safeErrorMessage(res)
    throw new Error(message)
  }

  return (await res.json()) as ReservationMutationResponse
}

export async function releaseInventoryReservation(
  orderId: string,
  reason?: string
): Promise<ReservationMutationResponse> {
  if (!inventoryBaseUrl) {
    return releaseMockReservation(orderId, reason)
  }

  const res = await fetch(
    `${inventoryBaseUrl}/reservations/${encodeURIComponent(orderId)}/release`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...inventoryAuthHeader,
      },
      body: JSON.stringify(reason ? { reason } : undefined),
    }
  )

  if (!res.ok) {
    const message = await safeErrorMessage(res)
    throw new Error(message)
  }

  return (await res.json()) as ReservationMutationResponse
}

export function getMockInventoryMetadata(sku: string) {
  return mockInventoryMetadata[sku]
}

export function getMockInventoryActivity() {
  return mockInventoryActivities
}

async function safeErrorMessage(res: Response) {
  try {
    const json = await res.json()
    if (typeof json.error === "string") return json.error
    if (typeof json.message === "string") return json.message
  } catch {
    // ignore json parse errors
  }
  return `Inventory service error (${res.status})`
}

function getOrCreateMockSummary(sku: string) {
  let summary = mockSummaryStore.get(sku)
  if (!summary) {
    summary = {
      sku,
      onHand: 0,
      reserved: 0,
      available: 0,
      updatedAt: new Date().toISOString(),
    }
    mockSummaryStore.set(sku, summary)
  }
  return summary
}

function adjustInMockStore(
  payload: InventoryAdjustmentPayload
): InventoryAdjustmentResponse {
  const summary = { ...getOrCreateMockSummary(payload.sku) }
  const newOnHand = summary.onHand + payload.delta
  if (newOnHand < 0) {
    throw new Error("Adjustment would result in negative on-hand quantity.")
  }

  summary.onHand = newOnHand
  summary.available = Math.max(summary.onHand - summary.reserved, 0)
  summary.updatedAt = new Date().toISOString()
  mockSummaryStore.set(payload.sku, summary)

  return {
    status: "applied",
    summary,
  }
}

function createMockReservation(
  payload: InventoryReservationPayload
): InventoryReservationResponse {
  const insufficientItems: InventoryReservationItem[] = []
  payload.items.forEach((item) => {
    const summary = getOrCreateMockSummary(item.sku)
    if (summary.available < item.qty) {
      insufficientItems.push(item)
    }
  })

  if (insufficientItems.length > 0) {
    return {
      status: "failed",
      reason: "INSUFFICIENT_STOCK",
      insufficientItems,
    }
  }

  payload.items.forEach((item) => {
    const summary = getOrCreateMockSummary(item.sku)
    summary.available -= item.qty
    summary.reserved += item.qty
    summary.updatedAt = new Date().toISOString()
    mockSummaryStore.set(item.sku, { ...summary })
  })

  const reservation: ReservationRecord = {
    payload,
    status: "reserved",
    expiresAt: payload.ttlSeconds
      ? new Date(Date.now() + payload.ttlSeconds * 1000).toISOString()
      : null,
  }
  mockReservationStore.set(payload.orderId, reservation)

  return {
    status: "reserved",
    items: payload.items,
    expiresAt: reservation.expiresAt,
  }
}

function commitMockReservation(
  orderId: string
): ReservationMutationResponse {
  const existing = mockReservationStore.get(orderId)
  if (!existing) return { status: "noop" }
  if (existing.status === "committed") return { status: "duplicate" }

  existing.payload.items.forEach((item) => {
    const summary = getOrCreateMockSummary(item.sku)
    summary.reserved = Math.max(summary.reserved - item.qty, 0)
    summary.onHand = Math.max(summary.onHand - item.qty, 0)
    summary.available = Math.max(summary.onHand - summary.reserved, 0)
    summary.updatedAt = new Date().toISOString()
    mockSummaryStore.set(item.sku, { ...summary })
  })

  existing.status = "committed"
  mockReservationStore.set(orderId, existing)

  return {
    status: "committed",
    items: existing.payload.items,
  }
}

function releaseMockReservation(
  orderId: string,
  reason?: string
): ReservationMutationResponse {
  const existing = mockReservationStore.get(orderId)
  if (!existing) return { status: "noop" }
  if (existing.status === "released") return { status: "duplicate" }

  existing.payload.items.forEach((item) => {
    const summary = getOrCreateMockSummary(item.sku)
    summary.reserved = Math.max(summary.reserved - item.qty, 0)
    summary.available = Math.max(summary.onHand - summary.reserved, 0)
    summary.updatedAt = new Date().toISOString()
    mockSummaryStore.set(item.sku, { ...summary })
  })

  existing.status = "released"
  mockReservationStore.set(orderId, existing)

  return {
    status: reason === "expired" ? "expired" : "released",
  }
}
