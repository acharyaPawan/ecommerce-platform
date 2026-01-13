import Link from "next/link"

import { CheckoutPanel } from "@/components/checkout/checkout-panel"
import { formatCurrency } from "@/lib/format"
import { loadCartView } from "@/lib/server/cart-view"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  const cartView = await loadCartView()

  if (!cartView || cartView.cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16">
        <div className="surface space-y-4 p-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Checkout
          </p>
          <h1 className="text-3xl font-semibold">Your cart is empty</h1>
          <p className="text-sm text-muted">
            Add items before starting checkout.
          </p>
          <Link
            href="/"
            className="accent-gradient inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            Browse catalog
          </Link>
        </div>
      </div>
    )
  }

  const subtotalLabel = formatCurrency(
    cartView.subtotalCents,
    cartView.currency
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-12">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Checkout</p>
        <h1 className="mt-2 text-3xl font-semibold">Finalize your order</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Order summary</h2>
          <div className="space-y-3">
            {cartView.items.map((item) => (
              <div
                key={`${item.sku}-${item.variantId ?? "base"}`}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-muted">Qty {item.qty}</p>
                </div>
                <p className="font-semibold">
                  {item.lineTotalCents !== null &&
                  item.lineTotalCents !== undefined &&
                  item.currency
                    ? formatCurrency(item.lineTotalCents, item.currency)
                    : "--"}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-[color:var(--line)] pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="font-semibold">{subtotalLabel}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted">Shipping</span>
              <span className="font-semibold">Calculated next</span>
            </div>
          </div>
        </div>
        <CheckoutPanel />
      </div>
    </div>
  )
}
