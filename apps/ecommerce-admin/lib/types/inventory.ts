export interface InventorySummary {
  sku: string
  onHand: number
  reserved: number
  available: number
  updatedAt: string
}

export interface InventoryAdjustmentPayload {
  sku: string
  delta: number
  reason: string
  referenceId?: string
}

export interface InventoryReservationItem {
  sku: string
  qty: number
}

export interface InventoryReservationPayload {
  orderId: string
  items: InventoryReservationItem[]
  ttlSeconds?: number
}

export interface InventoryReservationResponse {
  status: "reserved" | "duplicate" | "failed"
  items?: InventoryReservationItem[]
  reason?: "INVALID_ITEMS" | "INSUFFICIENT_STOCK"
  insufficientItems?: InventoryReservationItem[]
  expiresAt?: string | null
}

export interface InventoryAdjustmentResponse {
  status: "applied" | "duplicate"
  summary?: InventorySummary
}

export type ReservationMutationResponse =
  | { status: "committed"; items: InventoryReservationItem[] }
  | { status: "released" | "expired" | "noop" | "duplicate" }
