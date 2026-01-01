import { SectionHeading } from "@/components/shared/section-heading"

import { type ProductDTO } from "@/modules/catalog/server/query/dto/product-dto"

import { ProductCard } from "../ui/product-card"

type ProductGridSectionProps = {
  featured: ProductDTO[]
  supporting: ProductDTO[]
}

export function ProductGridSection({ featured, supporting }: ProductGridSectionProps) {
  return (
    <section id="catalog" className="space-y-8">
      <SectionHeading
        eyebrow="Catalog"
        title="Ops-ready SKUs and environments"
        description="Designed for mixed retail and hospitality teams that launch quick and iterate."
      />
      <div className="grid gap-8 lg:grid-cols-2">
        {featured.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {supporting.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
