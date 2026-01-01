"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getGatewayOrigin } from "@/lib/env"
import { httpFetch } from "@/lib/http"

const addToCartInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).max(10).default(1),
})

export type AddToCartInput = z.infer<typeof addToCartInputSchema>

export async function addToCartAction(input: AddToCartInput) {
  const payload = addToCartInputSchema.parse(input)
  const gatewayUrl = getGatewayOrigin()

  if (!gatewayUrl) {
    return {
      ok: true,
      message: "Added to collection",
      fallback: true,
    } as const
  }

  await httpFetch(`${gatewayUrl.replace(/\/$/, "")}/cart`, {
    method: "POST",
    body: JSON.stringify(payload),
  })

  revalidatePath("/")

  return {
    ok: true,
    message: "Added to bag",
    fallback: false,
  } as const
}
