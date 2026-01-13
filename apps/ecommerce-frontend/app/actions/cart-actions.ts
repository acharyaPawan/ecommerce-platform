"use server"

import { revalidatePath } from "next/cache"

import {
  addCartItem,
  checkoutCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/server/cart-client"
import { getCartId, setCartId } from "@/lib/server/cart-session"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import type { CartSnapshot } from "@/lib/types/cart"

export type CartActionState = {
  status: "idle" | "success" | "error"
  message?: string
}

export const cartActionInitialState: CartActionState = {
  status: "idle",
}

export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const sku = formData.get("sku")?.toString().trim()
  const qtyRaw = formData.get("qty")?.toString() ?? "1"
  const variantId = formData.get("variantId")?.toString()

  if (!sku) {
    return { status: "error", message: "Missing SKU." }
  }

  const qty = Number(qtyRaw)
  if (!Number.isFinite(qty) || qty <= 0) {
    return { status: "error", message: "Invalid quantity." }
  }

  try {
    const cartId = getCartId()
    const result = await withServiceAuthFromRequest(async () =>
      addCartItem({
        cartId,
        sku,
        qty,
        variantId: variantId || undefined,
        currency: "USD",
      })
    )

    if (result.headers.cartId) {
      setCartId(result.headers.cartId)
    }

    revalidatePath("/", "layout")
    revalidatePath("/cart")

    return { status: "success" }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to add item.",
    }
  }
}

export async function updateCartItemAction(formData: FormData) {
  const sku = formData.get("sku")?.toString().trim()
  const deltaRaw = formData.get("delta")?.toString()
  const qtyRaw = formData.get("qty")?.toString()
  const variantId = formData.get("variantId")?.toString()

  if (!sku) return
  const cartId = getCartId()
  if (!cartId) return

  const delta = deltaRaw ? Number(deltaRaw) : undefined
  const qty = qtyRaw ? Number(qtyRaw) : undefined

  if (delta !== undefined && !Number.isFinite(delta)) return
  if (qty !== undefined && (!Number.isFinite(qty) || qty < 0)) return

  try {
    await withServiceAuthFromRequest(async () =>
      updateCartItem({
        cartId,
        sku,
        delta,
        qty,
        variantId: variantId || undefined,
      })
    )

    revalidatePath("/", "layout")
    revalidatePath("/cart")
  } catch {
    // Ignore failed updates to avoid hard errors on the page.
  }
}

export async function removeCartItemAction(formData: FormData) {
  const sku = formData.get("sku")?.toString().trim()
  const variantId = formData.get("variantId")?.toString()
  if (!sku) return

  const cartId = getCartId()
  if (!cartId) return

  try {
    await withServiceAuthFromRequest(async () =>
      removeCartItem({
        cartId,
        sku,
        variantId: variantId || undefined,
      })
    )

    revalidatePath("/", "layout")
    revalidatePath("/cart")
  } catch {
    // Ignore failed updates to avoid hard errors on the page.
  }
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

export async function checkoutCartAction(
  _prev: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const cartId = getCartId()
  if (!cartId) {
    return { status: "error", message: "Cart not found." }
  }

  const refreshPricing = formData.get("refreshPricing") === "true"

  try {
    const result = await withServiceAuthFromRequest(async () =>
      checkoutCart({ cartId, refreshPricing })
    )

    revalidatePath("/", "layout")
    revalidatePath("/cart")
    revalidatePath("/checkout")

    return {
      status: "success",
      orderId: result.result.orderId,
      snapshot: result.result.snapshot,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Checkout failed.",
    }
  }
}
