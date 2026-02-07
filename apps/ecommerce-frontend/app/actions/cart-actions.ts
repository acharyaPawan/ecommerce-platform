"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  addCartItem,
  checkoutCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/server/cart-client"
import { createShipment } from "@/lib/server/fulfillment-client"
import { getCartId, setCartId } from "@/lib/server/cart-session"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import type {
  CartActionState,
  CheckoutActionState,
} from "@/app/actions/cart-action-state"
import logger from "@/lib/server/logger"

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
    const cartId = await getCartId()
    const result = await withServiceAuthFromRequest(async () =>
      addCartItem({
        cartId,
        sku,
        qty,
        variantId: variantId || undefined,
        currency: "USD",
      })
    )

    const nextCartId = result.headers.cartId ?? result.cart?.id
    if (nextCartId) {
      await setCartId(nextCartId)
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
  const cartId = await getCartId()
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

  const cartId = await getCartId()
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

export async function checkoutCartAction(
  _prev: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const cartId = await getCartId()
  if (!cartId) {
    return { status: "error", message: "Cart not found." }
  }

  const refreshPricing = formData.get("refreshPricing") === "true"
  let orderId: string | undefined

  try {
    const result = await withServiceAuthFromRequest(async () =>
      checkoutCart({ cartId, refreshPricing })
    )
    orderId = result.result.orderId
    revalidatePath("/", "layout")
    revalidatePath("/cart")

    if (orderId) {
      const confirmedOrderId = orderId
      const shipment = await withServiceAuthFromRequest(async () =>
        createShipment(confirmedOrderId)
      )
      if (!shipment) {
        logger.warn({ orderId: confirmedOrderId }, "checkout.fulfillment_shipment_not_created")
      }
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Checkout failed.",
    }
  }

  redirect(orderId ? `/orders/confirmation?orderId=${orderId}` : "/orders/confirmation")
}
