export type CartStatus = "active" | "checked_out"

export type CartItem = {
  sku: string
  qty: number
  variantId?: string | null
  selectedOptions?: Record<string, string>
  metadata?: Record<string, string | number | boolean | null>
}

export type CartPricingSnapshot = {
  subtotalCents: number | null
  currency: string
  itemCount: number
  totalQuantity: number
  computedAt: string
}

export type CartTotals = {
  itemCount: number
  totalQuantity: number
}

export type CartSnapshotItem = CartItem & {
  unitPriceCents?: number | null
  currency?: string | null
  title?: string | null
}

export type CartSnapshotTotals = CartTotals & {
  subtotalCents: number | null
  currency: string
}

export type Cart = {
  id: string
  userId?: string | null
  currency: string
  items: CartItem[]
  appliedCoupon?: string | null
  pricingSnapshot?: CartPricingSnapshot | null
  status: CartStatus
  version: number
  createdAt: string
  updatedAt: string
}

export type CartSnapshot = {
  snapshotId: string
  cartId: string
  cartVersion: number
  currency: string
  items: CartSnapshotItem[]
  totals: CartSnapshotTotals
  createdAt: string
  userId?: string | null
  signature: string
  pricingSnapshot?: CartPricingSnapshot | null
}

export type CartResponse = Cart & {
  totals: CartTotals
}

export type CartCheckoutResponse = {
  snapshot: CartSnapshot
  orderId?: string
}
