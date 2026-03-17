"use client"

import { useEffect, useRef } from "react"

import { trackStorefrontInteraction } from "@/lib/client/analytics"

export function ProductViewTracker({
  productId,
  variantId,
}: {
  productId: string
  variantId?: string
}) {
  const hasTracked = useRef(false)

  useEffect(() => {
    if (hasTracked.current) {
      return
    }

    hasTracked.current = true
    trackStorefrontInteraction({
      eventType: "view",
      productId,
      variantId,
      properties: {
        surface: "product-detail",
      },
    })
  }, [productId, variantId])

  return null
}
