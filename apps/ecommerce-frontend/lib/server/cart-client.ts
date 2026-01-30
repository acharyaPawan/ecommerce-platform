"use server"

import "server-only"

import type {
  CartCheckoutResponse,
  CartResponse,
} from "@/lib/types/cart"
import {
  ServiceRequestError,
  serviceFetch,
  serviceFetchWithResponse,
} from "@/lib/server/service-client"
import logger from "@/lib/server/logger"
import { headers } from "next/headers"
import next from "next"

type CartHeaderSnapshot = {
  cartId?: string
  cartVersion?: string
}

function readCartHeaders(response: Response): CartHeaderSnapshot {
  return {
    cartId: response.headers.get("x-cart-id") ?? undefined,
    cartVersion: response.headers.get("x-cart-version") ?? undefined,
  }
}

export async function getCart(cartId: string): Promise<CartResponse | null> {
  if (!cartId) return null
  const nextHeaders = await headers()
  const newHeader = new Headers(nextHeaders)
  newHeader.set("x-cart-id", cartId)

  logger.debug({ cartId, hasCartHeader: newHeader.has("x-cart-id") }, "cart.headers.prepared")
  try {
    return await serviceFetch<CartResponse>({
      service: "cart",
      path: "/",
      headers: newHeader,
    })
  } catch (error) {
    if (error instanceof ServiceRequestError && error.status === 404) {
      return null
    }
    throw error
  }
}

type AddItemInput = {
  cartId?: string
  sku: string
  qty: number
  variantId?: string
  currency?: string
}

export async function addCartItem(input: AddItemInput) {
  const headers: Record<string, string> = {}
  if (input.cartId) {
    headers["x-cart-id"] = input.cartId
  }
  if (input.currency) {
    headers["x-cart-currency"] = input.currency
  }

  const { data, response } = await serviceFetchWithResponse<CartResponse>({
    service: "cart",
    path: "/items",
    method: "POST",
    headers,
    body: JSON.stringify({
      sku: input.sku,
      qty: input.qty,
      variantId: input.variantId,
      currency: input.currency,
    }),
    idempotency: true,
  })

  return {
    cart: data,
    headers: readCartHeaders(response),
  }
}

type UpdateItemInput = {
  cartId: string
  sku: string
  qty?: number
  delta?: number
  variantId?: string
}

export async function updateCartItem(input: UpdateItemInput) {
  const { data, response } = await serviceFetchWithResponse<CartResponse>({
    service: "cart",
    path: `/items/${input.sku}`,
    method: "PATCH",
    headers: {
      "x-cart-id": input.cartId,
    },
    body: JSON.stringify({
      qty: input.qty,
      delta: input.delta,
      variantId: input.variantId,
    }),
    idempotency: true,
  })

  return {
    cart: data,
    headers: readCartHeaders(response),
  }
}

type RemoveItemInput = {
  cartId: string
  sku: string
  variantId?: string
}

export async function removeCartItem(input: RemoveItemInput) {
  const body = input.variantId
    ? JSON.stringify({ variantId: input.variantId })
    : undefined

  const { data, response } = await serviceFetchWithResponse<CartResponse>({
    service: "cart",
    path: `/items/${input.sku}`,
    method: "DELETE",
    headers: {
      "x-cart-id": input.cartId,
    },
    body,
    idempotency: true,
  })

  return {
    cart: data,
    headers: readCartHeaders(response),
  }
}

type CheckoutInput = {
  cartId: string
  refreshPricing?: boolean
}

export async function checkoutCart(input: CheckoutInput) {
  const body = input.refreshPricing
    ? JSON.stringify({ refreshPricing: true })
    : undefined

  const { data, response } = await serviceFetchWithResponse<CartCheckoutResponse>({
    service: "cart",
    path: "/checkout",
    method: "POST",
    headers: {
      "x-cart-id": input.cartId,
    },
    body,
    idempotency: true,
    timeoutMs: 20000
  })

  return {
    result: data,
    headers: readCartHeaders(response),
  }
}
