"use server"

import "server-only"

import { getMockInventoryActivity, getMockInventoryMetadata, getInventorySummary } from "@/lib/server/inventory-client"
import { listCatalogProducts } from "@/lib/server/catalog-client"
import type { CatalogProductStatus } from "@/lib/types/catalog"
import type { InventorySummary } from "@/lib/types/inventory"
import type { InventoryOperationalMetadata, InventoryActivity } from "@/lib/mock-data"

export type InventoryListItem = {
  productId: string
  variantId: string
  sku: string
  productTitle: string
  brand?: string | null
  status: "active" | "discontinued"
  attributes: Record<string, string>
  price: {
    currency: string
    amount: number
  } | null
  categories: string[]
  mediaUrl?: string
  summary: InventorySummary
  metadata?: InventoryOperationalMetadata
  lowStock: boolean
}

export interface InventoryDashboardData {
  items: InventoryListItem[]
  metrics: {
    totalSkus: number
    totalOnHand: number
    totalReserved: number
    totalAvailable: number
    lowStockSkus: number
    sellThroughRisk: number
  }
  activities: InventoryActivity[]
  lastRefreshed: string
}

type DashboardParams = {
  q?: string
  status?: CatalogProductStatus | "all"
}

export async function getInventoryDashboardData(
  params: DashboardParams = {}
): Promise<InventoryDashboardData> {
  const { items: products } = await listCatalogProducts({
    q: params.q,
    status: params.status,
    limit: 50,
  })

  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      product,
      variant,
    }))
  )

  const summaries = await Promise.all(
    variants.map(async ({ variant }) => {
      const summary = await getInventorySummary(variant.sku)
      return summary
    })
  )

  const items: InventoryListItem[] = variants.map(({ product, variant }, index) => {
    const summary =
      summaries[index] ??
      ({
        sku: variant.sku,
        onHand: 0,
        reserved: 0,
        available: 0,
        updatedAt: new Date().toISOString(),
      } satisfies InventorySummary)

    const metadata = getMockInventoryMetadata(variant.sku)
    const reorderPoint = metadata?.reorderPoint ?? 0
    const lowStock = reorderPoint > 0 ? summary.available <= reorderPoint : summary.available <= 25

    return {
      productId: product.id,
      variantId: variant.id,
      sku: variant.sku,
      productTitle: product.title,
      brand: product.brand,
      status: variant.status,
      attributes: variant.attributes,
      price: variant.prices[0]
        ? {
            currency: variant.prices[0].currency,
            amount: variant.prices[0].amountCents / 100,
          }
        : null,
      categories: product.categories.map((category) => category.name),
      mediaUrl: product.media[0]?.url,
      summary,
      metadata,
      lowStock,
    }
  })

  const totalOnHand = items.reduce((sum, item) => sum + item.summary.onHand, 0)
  const totalReserved = items.reduce(
    (sum, item) => sum + item.summary.reserved,
    0
  )
  const totalAvailable = items.reduce(
    (sum, item) => sum + item.summary.available,
    0
  )
  const lowStockSkus = items.filter((item) => item.lowStock).length

  const metrics = {
    totalSkus: items.length,
    totalOnHand,
    totalReserved,
    totalAvailable,
    lowStockSkus,
    sellThroughRisk:
      items.length > 0
        ? Math.round(
            (items.filter((item) => item.summary.available < item.summary.onHand * 0.3).length /
              items.length) *
              100
          )
        : 0,
  }

  const activities = getMockInventoryActivity()
  const latestTimestamp = items
    .map((item) => new Date(item.summary.updatedAt).getTime())
    .reduce((max, ts) => (Number.isFinite(ts) && ts > max ? ts : max), 0)

  return {
    items,
    metrics,
    activities,
    lastRefreshed: new Date(
      latestTimestamp > 0 ? latestTimestamp : Date.now()
    ).toISOString(),
  }
}
