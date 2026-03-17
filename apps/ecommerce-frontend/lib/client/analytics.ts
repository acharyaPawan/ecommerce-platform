"use client"

import type { InteractionEventType } from "@ecommerce/events"

type TrackStorefrontInteractionInput = {
  eventType: InteractionEventType
  productId: string
  variantId?: string
  occurredAt?: string
  properties?: Record<string, unknown>
}

export function trackStorefrontInteraction(
  input: TrackStorefrontInteractionInput
): void {
  void fetch("/api/analytics/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({
      eventType: input.eventType,
      productId: input.productId,
      variantId: input.variantId,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      properties: input.properties ?? {},
    }),
  })
}
