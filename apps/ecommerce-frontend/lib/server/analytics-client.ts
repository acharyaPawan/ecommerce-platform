import "server-only"

import {
  serviceFetchWithResponse,
  type ServiceRequestError,
} from "@/lib/server/service-client"
import type { InteractionEventType } from "@ecommerce/events"

type RecordStorefrontInteractionInput = {
  eventType: InteractionEventType
  productId: string
  variantId?: string
  sessionId?: string
  occurredAt?: string
  properties?: Record<string, unknown>
  idempotencyKey?: string
}

type RecordStorefrontInteractionResponse = {
  item: {
    id: string
    eventType: InteractionEventType
    productId: string
    variantId: string | null
    sessionId: string | null
    userId: string | null
    occurredAt: string
    createdAt: string
    source: "storefront"
    properties: Record<string, unknown>
    idempotent: boolean
  }
}

export async function recordStorefrontInteraction(
  input: RecordStorefrontInteractionInput
): Promise<RecordStorefrontInteractionResponse> {
  const result = await serviceFetchWithResponse<RecordStorefrontInteractionResponse>({
    service: "analytics",
    path: "/interactions",
    method: "POST",
    headers: input.idempotencyKey
      ? {
          "Idempotency-Key": input.idempotencyKey,
        }
      : undefined,
    json: {
      productId: input.productId,
      variantId: input.variantId,
      sessionId: input.sessionId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      source: "storefront",
      properties: input.properties ?? {},
    },
  })

  return result.data
}

export type { ServiceRequestError }
