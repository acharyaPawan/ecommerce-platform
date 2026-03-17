import { NextResponse } from "next/server"
import { z } from "zod"
import type { InteractionEventType } from "@ecommerce/events"

import { recordStorefrontInteraction } from "@/lib/server/analytics-client"
import { getOrCreateAnalyticsSessionId } from "@/lib/server/analytics-session"
import { loadVerifiedAuthSession } from "@/lib/server/auth-session"
import { ServiceRequestError } from "@/lib/server/service-client"

const storefrontInteractionEventTypes = [
  "view",
  "click",
  "wishlist_add",
  "cart_add",
  "purchase",
  "rating",
  "review",
] as const satisfies readonly InteractionEventType[]

const analyticsEventRequestSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1).optional(),
  eventType: z.enum(storefrontInteractionEventTypes),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const parsed = analyticsEventRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const session = await loadVerifiedAuthSession()
  const sessionId = await getOrCreateAnalyticsSessionId()

  try {
    const result = await recordStorefrontInteraction({
      eventType: parsed.data.eventType,
      productId: parsed.data.productId,
      variantId: parsed.data.variantId,
      occurredAt: parsed.data.occurredAt,
      properties: {
        ...parsed.data.properties,
        pageSource: "storefront-web",
        authenticated: Boolean(session),
      },
      sessionId,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof ServiceRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    return NextResponse.json({ error: "Failed to record interaction" }, { status: 500 })
  }
}
