"use server"

import "server-only"

import { getInventorySummary } from "@/lib/server/inventory-client"
import { listCatalogProducts } from "@/lib/server/catalog-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import { formatRelativeTimeFromNow } from "@/lib/format"
import type { CatalogProductStatus } from "@/lib/types/catalog"
import type { InventorySummary } from "@/lib/types/inventory"

export type InventoryListItem = {
  productId: string
  variantId: string
  sku: string
  productTitle: string
  productDescription?: string | null
  productStatus: CatalogProductStatus
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
  summaryUpdatedLabel: string
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
  lastRefreshed: string
}

type DashboardParams = {
  q?: string
  status?: CatalogProductStatus | "all"
}

export async function getInventoryDashboardData(
  params: DashboardParams = {}
): Promise<InventoryDashboardData> {
  return withServiceAuthFromRequest(async () => {
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

      const lowStock = summary.available <= Math.max(summary.onHand * 0.25, 25)

      return {
        productId: product.id,
        variantId: variant.id,
        sku: variant.sku,
        productTitle: product.title,
        productDescription: product.description,
        productStatus: product.status,
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
        summaryUpdatedLabel: formatRelativeTimeFromNow(summary.updatedAt),
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

    const latestTimestamp = items
      .map((item) => new Date(item.summary.updatedAt).getTime())
      .reduce((max, ts) => (Number.isFinite(ts) && ts > max ? ts : max), 0)

    return {
      items,
      metrics,
      lastRefreshed: new Date(
        latestTimestamp > 0 ? latestTimestamp : Date.now()
      ).toISOString(),
    }
  })
}
