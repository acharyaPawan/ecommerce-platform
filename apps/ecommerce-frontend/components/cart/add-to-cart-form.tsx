"use client"

import { useActionState } from "react"

import { addToCartAction } from "@/app/actions/cart-actions"
import { cartActionInitialState } from "@/app/actions/cart-action-state"
import { SubmitButton } from "@/components/ui/submit-button"

export function AddToCartForm({
  sku,
  qty = 1,
  variantId,
}: {
  sku: string
  qty?: number
  variantId?: string | null
}) {
  const [state, action] = useActionState(
    addToCartAction,
    cartActionInitialState
  )

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sku" value={sku} />
      <input type="hidden" name="qty" value={qty} />
      {variantId ? (
        <input type="hidden" name="variantId" value={variantId} />
      ) : null}
      <SubmitButton variant="primary" size="sm" pendingLabel="Adding...">
        Add to cart
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-xs text-[color:var(--accent-strong)]">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-xs text-[color:var(--teal)]">Added to cart.</p>
      ) : null}
    </form>
  )
}
