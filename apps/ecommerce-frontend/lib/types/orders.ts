import type { CartSnapshot } from "@/lib/types/cart"

export type OrderStatus =
  | "pending_inventory"
  | "confirmed"
  | "rejected"
  | "canceled"

export type OrderRecord = {
  id: string
  status: OrderStatus
  currency: string
  userId: string | null
  totals: Record<string, unknown>
  cartSnapshot: CartSnapshot
  cancellationReason: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
}
