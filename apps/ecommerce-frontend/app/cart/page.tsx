import Link from "next/link"

import { CartItemRow } from "@/components/cart/cart-item-row"
import { buttonVariants } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import { loadCartView } from "@/lib/server/cart-view"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function CartPage() {
  const cartView = await loadCartView()

  if (!cartView || cartView.cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16">
        <div className="surface space-y-4 p-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Your cart
          </p>
          <h1 className="text-3xl font-semibold">Your cart is empty</h1>
          <p className="text-sm text-muted">
            Browse the catalog to add your first curated find.
          </p>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            Start shopping
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
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Your cart</p>
        <h1 className="mt-2 text-3xl font-semibold">Review your picks</h1>
      </div>
      <div className="space-y-4">
        {cartView.items.map((item) => (
          <CartItemRow key={`${item.sku}-${item.variantId ?? "base"}`} item={item} />
        ))}
      </div>
      <div className="surface flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Subtotal
          </p>
          <p className="text-2xl font-semibold">{subtotalLabel}</p>
          <p className="text-sm text-muted">
            Taxes and shipping calculated at checkout.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            Keep shopping
          </Link>
          <Link
            href="/checkout"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  )
}
