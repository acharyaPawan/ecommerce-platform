import "server-only"

import { listCatalogProducts, quoteCatalogPricing } from "@/lib/server/catalog-client"
import { getCart } from "@/lib/server/cart-client"
import { getCartId } from "@/lib/server/cart-session"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import type { CatalogProduct, CatalogVariant } from "@/lib/types/catalog"
import type { CartResponse } from "@/lib/types/cart"

export type CartViewItem = {
  sku: string
  qty: number
  title: string
  productId?: string
  variantId?: string | null
  imageUrl?: string | null
  priceCents?: number | null
  currency?: string
  lineTotalCents?: number | null
  attributes?: Record<string, string>
}

export type CartView = {
  cart: CartResponse
  items: CartViewItem[]
  subtotalCents: number
  currency: string
}

function buildSkuIndex(products: CatalogProduct[]) {
  const index = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>()
  for (const product of products) {
    for (const variant of product.variants) {
      index.set(normalizeSku(variant.sku), { product, variant })
    }
  }
  return index
}

function buildVariantIndex(products: CatalogProduct[]) {
  const index = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>()
  for (const product of products) {
    for (const variant of product.variants) {
      index.set(variant.id, { product, variant })
    }
  }
  return index
}

function buildCartView(cart: CartResponse, products: CatalogProduct[]): CartView {
  const skuIndex = buildSkuIndex(products)
  const variantIndex = buildVariantIndex(products)

  const items = cart.items.map((item) => {
    const match =
      (item.variantId ? variantIndex.get(item.variantId) : undefined) ??
      skuIndex.get(normalizeSku(item.sku))
    const price = match?.variant.prices[0]
    const priceCents = price?.amountCents ?? null
    const currency = price?.currency ?? cart.currency
    const lineTotalCents =
      priceCents !== null && priceCents !== undefined
        ? priceCents * item.qty
        : null

    return {
      sku: item.sku,
      qty: item.qty,
      title: match?.product.title ?? item.sku,
      productId: match?.product.id,
      variantId: item.variantId ?? match?.variant.id ?? null,
      imageUrl: match?.product.media[0]?.url ?? null,
      priceCents,
      currency,
      lineTotalCents,
      attributes: match?.variant.attributes,
    }
  })

  const subtotalCents = items.reduce((sum, item) => {
    if (item.lineTotalCents !== null && item.lineTotalCents !== undefined) {
      return sum + item.lineTotalCents
    }
    return sum
  }, 0)

  const currency = items.find((item) => item.currency)?.currency ?? cart.currency

  return {
    cart,
    items,
    subtotalCents,
    currency,
  }
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase()
}

function buildFallbackCartView(cart: CartResponse): CartView {
  const items = cart.items.map((item) => {
    return {
      sku: item.sku,
      qty: item.qty,
      title: item.sku,
      productId: undefined,
      variantId: item.variantId ?? null,
      imageUrl: null,
      priceCents: null,
      currency: cart.currency,
      lineTotalCents: null,
      attributes: item.selectedOptions,
    }
  })

  return {
    cart,
    items,
    subtotalCents: cart.pricingSnapshot?.subtotalCents ?? 0,
    currency: cart.currency,
  }
}

function applyPricingQuotes(view: CartView, quotes: Array<{
  sku: string
  variantId: string
  unitPriceCents: number
  currency: string
  title: string | null
}>): CartView {
  if (quotes.length === 0) return view

  const byVariantId = new Map(quotes.map((quote) => [quote.variantId, quote]))
  const bySku = new Map(quotes.map((quote) => [normalizeSku(quote.sku), quote]))

  const items = view.items.map((item) => {
    if (item.priceCents !== null && item.priceCents !== undefined && item.currency) {
      return item
    }

    const quote =
      (item.variantId ? byVariantId.get(item.variantId) : undefined) ??
      bySku.get(normalizeSku(item.sku))

    if (!quote) {
      return item
    }

    const priceCents = quote.unitPriceCents
    const currency = quote.currency
    const lineTotalCents = priceCents * item.qty
    const title = item.title === item.sku && quote.title ? quote.title : item.title

    return {
      ...item,
      title,
      priceCents,
      currency,
      lineTotalCents,
    }
  })

  const subtotalCents = items.reduce((sum, item) => {
    if (item.lineTotalCents !== null && item.lineTotalCents !== undefined) {
      return sum + item.lineTotalCents
    }
    return sum
  }, 0)

  const currency = items.find((item) => item.currency)?.currency ?? view.currency

  return {
    ...view,
    items,
    subtotalCents,
    currency,
  }
}

export async function loadCartView(): Promise<CartView | null> {
  const cartId = await getCartId()
  if (!cartId) return null

  return withServiceAuthFromRequest(async () => {
    const cart = await getCart(cartId)
    if (!cart) return null
    if (cart.items.length === 0) {
      return {
        cart,
        items: [],
        subtotalCents: 0,
        currency: cart.currency,
      }
    }

    try {
      const { items: products } = await listCatalogProducts({
        status: "published",
        limit: 200,
      })

      const view = buildCartView(cart, products)
      const missingPriceItems = view.items.filter(
        (item) => item.priceCents === null || item.priceCents === undefined
      )
      if (missingPriceItems.length === 0) {
        return view
      }

      try {
        const { items: quotes } = await quoteCatalogPricing(
          missingPriceItems.map((item) => ({
            sku: item.sku,
            variantId: item.variantId ?? null,
          }))
        )
        return applyPricingQuotes(view, quotes)
      } catch {
        return view
      }
    } catch {
      const fallback = buildFallbackCartView(cart)
      try {
        const { items: quotes } = await quoteCatalogPricing(
          cart.items.map((item) => ({
            sku: item.sku,
            variantId: item.variantId ?? null,
          }))
        )
        return applyPricingQuotes(fallback, quotes)
      } catch {
        return fallback
      }
    }
  })
}
