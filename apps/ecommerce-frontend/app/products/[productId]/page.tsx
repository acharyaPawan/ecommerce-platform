import Link from "next/link"
import { notFound } from "next/navigation"

import { AddToCartForm } from "@/components/cart/add-to-cart-form"
import { formatCurrency } from "@/lib/format"
import { getCatalogProduct } from "@/lib/server/catalog-client"
import {
  getPrimaryPrice,
  getPrimaryVariant,
  getProductImage,
} from "@/lib/utils/catalog"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ productId: string }>
}

export default async function ProductPage({ params }: PageProps) {
  const { productId } = await params
  const product = await getCatalogProduct(productId)
  if (!product) {
    notFound()
  }

  const primaryVariant = getPrimaryVariant(product)
  const primaryPrice = getPrimaryPrice(primaryVariant)
  const heroImage = getProductImage(product)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-[color:var(--teal)]">
        Back to catalog
      </Link>
      <section className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="surface overflow-hidden">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-80 items-center justify-center bg-[radial-gradient(circle_at_top,var(--glow),transparent_70%)] text-sm text-muted">
              Image coming soon
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              {product.categories.map((category) => category.name).join(" · ") ||
                "Uncategorized"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
              {product.title}
            </h1>
            {primaryPrice ? (
              <p className="mt-4 text-2xl font-semibold text-[color:var(--teal)]">
                {formatCurrency(primaryPrice.amountCents, primaryPrice.currency)}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">Pricing updates soon.</p>
            )}
          </div>
          <p className="text-base text-muted">
            {product.description ??
              "Made with thoughtful materials and balanced for daily rituals. This piece fits seamlessly into your home or workspace."}
          </p>
          {primaryVariant ? (
            <div className="surface-strong space-y-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">
                  Variant details
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {Object.entries(primaryVariant.attributes).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-[color:var(--line)] bg-white/80 px-3 py-1"
                    >
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </div>
              <AddToCartForm
                sku={primaryVariant.sku}
                variantId={primaryVariant.id}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">
              This item is currently unavailable.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
