"use client"

import { useActionState } from "react"

import { checkoutCartAction } from "@/app/actions/cart-actions"
import { checkoutActionInitialState } from "@/app/actions/cart-action-state"
import { SubmitButton } from "@/components/ui/submit-button"
import { formatCurrency } from "@/lib/format"

export function CheckoutPanel() {
  const [state, action] = useActionState(
    checkoutCartAction,
    checkoutActionInitialState
  )

  console.log("CheckoutPanel state:", state)

  const subtotalValue = state.snapshot?.totals.subtotalCents
  console.log("CheckoutPanel subtotalValue:", subtotalValue)
  const subtotal =
    subtotalValue !== null &&
    subtotalValue !== undefined &&
    state.snapshot?.totals.currency
      ? formatCurrency(subtotalValue, state.snapshot.totals.currency)
      : null

  return (
    <div className="surface space-y-4 p-6">
      <div>
        <h2 className="text-xl font-semibold">Ready to place your order?</h2>
        <p className="text-sm text-muted">
          We will use the current cart snapshot to create the order.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="refreshPricing" value="true" />
        <SubmitButton size="lg" pendingLabel="Placing order...">
          Place order
        </SubmitButton>
      </form>
      {state.status === "error" ? (
        <p className="text-sm text-[color:var(--accent-strong)]">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.snapshot ? (
        <div className="surface-strong space-y-3 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Order confirmation
            </p>
            <p className="text-lg font-semibold">
              Order {state.orderId ?? "created"}
            </p>
            {subtotal ? (
              <p className="text-sm text-muted">Subtotal {subtotal}</p>
            ) : (
              <p className="text-sm text-muted">Subtotal pending pricing</p>
            )}
          </div>
          <div className="space-y-2 text-sm text-muted">
            {state.snapshot.items.map((item) => (
              <div key={`${item.sku}-${item.variantId ?? "base"}`}>
                <p className="font-semibold text-[color:var(--ink)]">
                  {item.title ?? item.sku}
                </p>
                <p>
                  Qty {item.qty}
                  {item.unitPriceCents !== null &&
                  item.unitPriceCents !== undefined &&
                  item.currency
                    ? ` · ${formatCurrency(item.unitPriceCents, item.currency)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
