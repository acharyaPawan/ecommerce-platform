"use server"

import "server-only"

import { ServiceRequestError, serviceFetch } from "@/lib/server/service-client"
import type {
  CreateShipmentResponse,
  Shipment,
  ShippingOptionsResponse,
} from "@/lib/types/fulfillment"

type ShippingOptionsInput = {
  country?: string
  postalCode?: string
}

export async function getShippingOptions(
  input: ShippingOptionsInput = {}
): Promise<ShippingOptionsResponse | null> {
  try {
    return await serviceFetch<ShippingOptionsResponse>({
      service: "fulfillment",
      path: "/shipping/options",
      searchParams: {
        country: input.country,
        postalCode: input.postalCode,
      },
    })
  } catch (error) {
    if (error instanceof ServiceRequestError) {
      return null
    }
    throw error
  }
}

export async function createShipment(orderId: string): Promise<Shipment | null> {
  if (!orderId) return null

  try {
    const response = await serviceFetch<CreateShipmentResponse>({
      service: "fulfillment",
      path: "/shipments",
      method: "POST",
      json: { orderId },
      idempotency: true,
    })
    return response.shipment
  } catch (error) {
    if (error instanceof ServiceRequestError) {
      return null
    }
    throw error
  }
}

export async function getShipment(orderId: string): Promise<Shipment | null> {
  if (!orderId) return null

  try {
    return await serviceFetch<Shipment>({
      service: "fulfillment",
      path: "/shipments",
      searchParams: {
        orderId,
      },
    })
  } catch (error) {
    if (error instanceof ServiceRequestError && error.status === 404) {
      return null
    }
    if (error instanceof ServiceRequestError) {
      return null
    }
    throw error
  }
}
