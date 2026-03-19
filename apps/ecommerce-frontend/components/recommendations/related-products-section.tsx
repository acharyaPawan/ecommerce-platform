import Link from "next/link"

import { ProductCard } from "@/components/product-card"
import type { RankedRecommendation } from "@/lib/recommendations/hybrid"
import type { CatalogProduct } from "@/lib/types/catalog"

export function RelatedProductsSection({
  products,
  recommendations,
}: {
  products: CatalogProduct[]
  recommendations: RankedRecommendation[]
}) {
  if (products.length === 0) {
    return null
  }

  const recommendationByProductId = new Map(
    recommendations.map((item) => [item.productId, item])
  )

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Recommendation baseline
          </p>
          <h2 className="text-2xl font-semibold">Related from live behavior</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            These suggestions come from actual storefront interaction patterns,
            weighted by stronger signals like cart adds and purchases.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold text-[color:var(--teal)]">
          Back to catalog
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const signal = recommendationByProductId.get(product.id)
          return (
            <div key={product.id} className="space-y-3">
              <ProductCard product={product} />
              {signal ? (
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-xs text-muted">
                  <p className="font-medium text-[color:var(--ink)]">
                    {signal.explanation.summary}
                  </p>
                  <p>
                    Signal: <span className="font-semibold text-[color:var(--ink)]">{signal.strongestEventType}</span>
                  </p>
                  <p>
                    Supporting events:{" "}
                    <span className="font-semibold text-[color:var(--ink)]">
                      {signal.supportingSignals}
                    </span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {signal.explanation.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
