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
  console.log(`Built SKU index with ${index.size} entries`)
  return index
}

function buildVariantIndex(products: CatalogProduct[]) {
  const index = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>()
  for (const product of products) {
    for (const variant of product.variants) {
      index.set(variant.id, { product, variant })
    }
  }
  console.log(`Built variant index with ${index.size} entries`)
  return index
}

function buildCartView(cart: CartResponse, products: CatalogProduct[]): CartView {
  console.log(`Building cart view for ${cart.items.length} items from ${products.length} products`)
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
  console.log(`Cart view built: ${items.length} items, subtotal ${subtotalCents} ${currency}`)

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
  console.log(`Building fallback cart view for ${cart.items.length} items`)
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
  console.log(`Applying ${quotes.length} pricing quotes to ${view.items.length} items`)
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
  console.log(`Pricing applied: new subtotal ${subtotalCents} ${currency}`)

  return {
    ...view,
    items,
    subtotalCents,
    currency,
  }
}

export async function loadCartView(): Promise<CartView | null> {
  console.log("Loading cart view")
  const cartId = await getCartId()
  if (!cartId) {
    console.log("No cart ID found")
    return null
  }

  console.log(`Cart ID: ${cartId}`)
  return withServiceAuthFromRequest(async () => {
    const cart = await getCart(cartId)
    if (!cart) {
      console.log(`Cart not found for ID: ${cartId}`)
      return null
    }
    console.log(`Cart loaded with ${cart.items.length} items`)
    
    if (cart.items.length === 0) {
      console.log("Cart is empty, returning empty view")
      return {
        cart,
        items: [],
        subtotalCents: 0,
        currency: cart.currency,
      }
    }

    try {
      console.log("Fetching published catalog products")
      const { items: products } = await listCatalogProducts({
        status: "published",
        limit: 100,
      })
      console.log(`Loaded ${products.length} catalog products`)

      const view = buildCartView(cart, products)
      const missingPriceItems = view.items.filter(
        (item) => item.priceCents === null || item.priceCents === undefined
      )
      console.log(`Found ${missingPriceItems.length} items with missing prices`)
      
      if (missingPriceItems.length === 0) {
        console.log("All items have prices, returning cart view")
        return view
      }

      try {
        console.log(`Requesting pricing quotes for ${missingPriceItems.length} items`)
        const { items: quotes } = await quoteCatalogPricing(
          missingPriceItems.map((item) => ({
            sku: item.sku,
            variantId: item.variantId ?? null,
          }))
        )
        console.log(`Received ${quotes.length} pricing quotes`)
        return applyPricingQuotes(view, quotes)
      } catch (error) {
        console.error("Failed to quote pricing, returning view without pricing", error)
        return view
      }
    } catch (error) {
      console.error("Failed to fetch catalog products, using fallback", error)
      const fallback = buildFallbackCartView(cart)
      try {
        console.log(`Requesting pricing quotes for all ${cart.items.length} items`)
        const { items: quotes } = await quoteCatalogPricing(
          cart.items.map((item) => ({
            sku: item.sku,
            variantId: item.variantId ?? null,
          }))
        )
        console.log(`Received ${quotes.length} pricing quotes`)
        return applyPricingQuotes(fallback, quotes)
      } catch (quoteError) {
        console.error("Failed to quote pricing on fallback, returning fallback view", quoteError)
        return fallback
      }
    }
  })
}
