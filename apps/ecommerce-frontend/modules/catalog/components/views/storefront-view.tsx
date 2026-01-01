import { Suspense } from "react"

import { type StorefrontData } from "@/modules/catalog/server/query/service/product-service"

import { EditorialSection } from "../sections/editorial-section"
import { FilterBar } from "../sections/filter-bar"
import { HeroSection } from "../sections/hero-section"
import { CollectionSpotlightSection } from "../sections/collection-spotlight-section"
import { ProductGridSection } from "../sections/product-grid-section"
import { StorefrontShell } from "../layout/storefront-shell"

type StorefrontViewProps = {
  data: StorefrontData
}

export function StorefrontView({ data }: StorefrontViewProps) {
  return (
    <StorefrontShell>
      <HeroSection product={data.hero} />
      <Suspense>
        <FilterBar />
      </Suspense>
      <ProductGridSection featured={data.featuredProducts} supporting={data.supportingProducts} />
      <CollectionSpotlightSection collections={data.collections} />
      <EditorialSection stories={data.stories} />
    </StorefrontShell>
  )
}
