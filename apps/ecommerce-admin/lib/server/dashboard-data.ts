"use server"

import "server-only"

import { getInventorySummaries } from "@/lib/server/inventory-client"
import { listCatalogProducts } from "@/lib/server/catalog-client"
import logger from "@/lib/server/logger"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import { formatRelativeTimeFromNow } from "@/lib/format"
import { isAllowedRemoteImageHost } from "@/lib/media-hosts"
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

    const summariesBySku = await getInventorySummaries(
      variants.map(({ variant }) => variant.sku)
    )

    let droppedMediaCount = 0
    const items: InventoryListItem[] = variants.map(({ product, variant }) => {
      const normalizedSku = variant.sku.trim().toUpperCase()
      const summary =
        summariesBySku.get(normalizedSku) ??
        ({
          sku: variant.sku,
          onHand: 0,
          reserved: 0,
          available: 0,
          updatedAt: new Date().toISOString(),
        } satisfies InventorySummary)

      const lowStock = summary.available <= Math.max(summary.onHand * 0.25, 25)

      const mediaUrl = selectDashboardMediaUrl(product.media[0]?.url, {
        productId: product.id,
        sku: variant.sku,
      })
      if (product.media[0]?.url && !mediaUrl) {
        droppedMediaCount += 1
      }

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
        mediaUrl,
        summary,
        summaryUpdatedLabel: formatRelativeTimeFromNow(summary.updatedAt),
        lowStock,
      }
    })

    logger.debug(
      {
        products: products.length,
        variants: variants.length,
        inventoryFound: summariesBySku.size,
        inventoryMissing: Math.max(variants.length - summariesBySku.size, 0),
        mediaDropped: droppedMediaCount,
      },
      "dashboard.data.loaded"
    )

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

function selectDashboardMediaUrl(
  input: string | undefined,
  context: { productId: string; sku: string }
): string | undefined {
  if (!input) {
    return undefined
  }

  try {
    const url = new URL(input)
    if (!/^https?:$/.test(url.protocol)) {
      logger.warn(
        {
          ...context,
          mediaUrl: input,
          protocol: url.protocol,
        },
        "dashboard.media.unsupported_protocol"
      )
      return undefined
    }

    if (!isAllowedRemoteImageHost(url.hostname)) {
      logger.warn(
        {
          ...context,
          mediaUrl: input,
          host: url.hostname,
        },
        "dashboard.media.unconfigured_host"
      )
      return undefined
    }

    return input
  } catch {
    logger.warn(
      {
        ...context,
        mediaUrl: input,
      },
      "dashboard.media.invalid_url"
    )
    return undefined
  }
}
