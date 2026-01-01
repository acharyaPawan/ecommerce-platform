import { getWaitlistInsights } from "@/modules/account/server/query/service/waitlist-service"
import { WaitlistSection } from "@/modules/account/components/sections/waitlist-section"
import { StorefrontView } from "@/modules/catalog/components/views/storefront-view"
import { getCatalogSearchState } from "@/modules/catalog/lib/catalog-search-params"
import { loadStorefrontData } from "@/modules/catalog/server/query/service/product-service"

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function Page({ searchParams }: PageProps) {
  const catalogFilters = getCatalogSearchState(searchParams)

  const [storefrontData, waitlistInsights] = await Promise.all([
    loadStorefrontData(catalogFilters),
    getWaitlistInsights(),
  ])

  return (
    <div className="space-y-16 pb-16">
      <StorefrontView data={storefrontData} />
      <div className="mx-auto w-full max-w-5xl px-4">
        <WaitlistSection insights={waitlistInsights} />
      </div>
    </div>
  )
}
