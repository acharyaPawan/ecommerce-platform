import type { CartSnapshot } from "@/lib/types/cart"

export type CartActionState = {
  status: "idle" | "success" | "error"
  message?: string
}

export const cartActionInitialState: CartActionState = {
  status: "idle",
}

export type CheckoutActionState = {
  status: "idle" | "success" | "error"
  message?: string
  orderId?: string
  snapshot?: CartSnapshot
}

export const checkoutActionInitialState: CheckoutActionState = {
  status: "idle",
}
