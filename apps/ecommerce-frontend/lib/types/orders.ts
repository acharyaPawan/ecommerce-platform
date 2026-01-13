import type { CartSnapshot } from "@/lib/types/cart"

export type OrderRecord = {
  id: string
  status: string
  currency: string
  userId: string | null
  totals: Record<string, unknown>
  cartSnapshot: CartSnapshot
  cancellationReason: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
}
