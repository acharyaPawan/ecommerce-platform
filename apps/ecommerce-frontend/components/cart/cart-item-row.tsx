import Link from "next/link"

import {
  removeCartItemAction,
  updateCartItemAction,
} from "@/app/actions/cart-actions"
import { SubmitButton } from "@/components/ui/submit-button"
import { formatCurrency } from "@/lib/format"
import type { CartViewItem } from "@/lib/server/cart-view"

export function CartItemRow({ item }: { item: CartViewItem }) {
  const priceCents =
    item.priceCents !== null && item.priceCents !== undefined
      ? item.priceCents
      : null
  const lineTotalCents =
    item.lineTotalCents !== null && item.lineTotalCents !== undefined
      ? item.lineTotalCents
      : null

  const priceLabel =
    priceCents !== null && item.currency
      ? formatCurrency(priceCents, item.currency)
      : "--"

  const lineTotalLabel =
    lineTotalCents !== null && item.currency
      ? formatCurrency(lineTotalCents, item.currency)
      : "--"

  return (
    <div className="surface flex flex-col gap-4 p-4 md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-2xl bg-[color:var(--surface-strong)]">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted">
              No image
            </div>
          )}
        </div>
        <div>
          {item.productId ? (
            <Link
              href={`/products/${item.productId}`}
              className="text-base font-semibold"
            >
              {item.title}
            </Link>
          ) : (
            <p className="text-base font-semibold">{item.title}</p>
          )}
          <p className="text-sm text-muted">SKU {item.sku}</p>
          {item.attributes ? (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
              {Object.entries(item.attributes).map(([key, value]) => (
                <span key={key}>
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="ml-auto flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Price
          </p>
          <p className="text-sm font-semibold">{priceLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <form action={updateCartItemAction}>
            <input type="hidden" name="sku" value={item.sku} />
            {item.variantId ? (
              <input type="hidden" name="variantId" value={item.variantId} />
            ) : null}
            <input type="hidden" name="delta" value="-1" />
            <SubmitButton variant="secondary" size="sm" pendingLabel="...">
              -
            </SubmitButton>
          </form>
          <span className="text-sm font-semibold">{item.qty}</span>
          <form action={updateCartItemAction}>
            <input type="hidden" name="sku" value={item.sku} />
            {item.variantId ? (
              <input type="hidden" name="variantId" value={item.variantId} />
            ) : null}
            <input type="hidden" name="delta" value="1" />
            <SubmitButton variant="secondary" size="sm" pendingLabel="...">
              +
            </SubmitButton>
          </form>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Total</p>
          <p className="text-sm font-semibold">{lineTotalLabel}</p>
        </div>
        <form action={removeCartItemAction}>
          <input type="hidden" name="sku" value={item.sku} />
          {item.variantId ? (
            <input type="hidden" name="variantId" value={item.variantId} />
          ) : null}
          <SubmitButton variant="ghost" size="sm" pendingLabel="Removing...">
            Remove
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
