import { ProductCard } from "@/components/product-card"
import type { CatalogProduct } from "@/lib/types/catalog"
import type { RelatedProductRecommendation } from "@/lib/types/analytics"

export function PersonalizedProductsSection({
  products,
  recommendations,
  personalizedFor,
}: {
  products: CatalogProduct[]
  recommendations: RelatedProductRecommendation[]
  personalizedFor: "user" | "session"
}) {
  if (products.length === 0) {
    return null
  }

  const recommendationByProductId = new Map(
    recommendations.map((item) => [item.productId, item])
  )

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Recommended for you
        </p>
        <h2 className="text-2xl font-semibold">
          {personalizedFor === "user"
            ? "Personalized from your storefront behavior"
            : "Adaptive picks from your recent browsing"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          This shelf is generated from your own interaction history and similar
          user or session patterns, then backed off to popular products when
          history is sparse.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const signal = recommendationByProductId.get(product.id)
          return (
            <div key={product.id} className="space-y-3">
              <ProductCard product={product} />
              {signal ? (
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-xs text-muted">
                  <p>
                    Strongest signal:{" "}
                    <span className="font-semibold text-[color:var(--ink)]">
                      {signal.strongestEventType}
                    </span>
                  </p>
                  <p>
                    Supporting events:{" "}
                    <span className="font-semibold text-[color:var(--ink)]">
                      {signal.supportingSignals}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
