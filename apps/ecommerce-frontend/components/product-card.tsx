import Link from "next/link"

import { AddToCartForm } from "@/components/cart/add-to-cart-form"
import { formatCurrency } from "@/lib/format"
import type { CatalogProduct } from "@/lib/types/catalog"
import {
  getPrimaryPrice,
  getPrimaryVariant,
  getProductImage,
} from "@/lib/utils/catalog"

export function ProductCard({ product }: { product: CatalogProduct }) {
  const primaryVariant = getPrimaryVariant(product)
  const primaryPrice = getPrimaryPrice(primaryVariant)
  const heroImage = getProductImage(product)

  return (
    <div className="group surface flex h-full flex-col overflow-hidden">
      <Link
        href={`/products/${product.id}`}
        className="relative block h-48 overflow-hidden"
      >
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,var(--glow),transparent_70%)]">
            <span className="text-sm text-muted">Image coming soon</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {product.categories[0]?.name ?? "Uncategorized"}
          </p>
          <Link href={`/products/${product.id}`}>
            <h3 className="mt-2 text-lg font-semibold leading-snug">
              {product.title}
            </h3>
          </Link>
          {primaryPrice ? (
            <p className="mt-2 text-base font-semibold text-[color:var(--teal)]">
              {formatCurrency(primaryPrice.amountCents, primaryPrice.currency)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Pricing updates soon</p>
          )}
        </div>
        <p className="text-sm text-muted line-clamp-2">
          {product.description ?? "A thoughtfully crafted item for everyday rituals."}
        </p>
        <div className="mt-auto">
          {primaryVariant ? (
            <AddToCartForm
              sku={primaryVariant.sku}
              variantId={primaryVariant.id}
            />
          ) : (
            <p className="text-xs text-muted">Currently unavailable</p>
          )}
        </div>
      </div>
    </div>
  )
}
