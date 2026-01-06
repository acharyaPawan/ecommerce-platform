"use server"

import { revalidatePath } from "next/cache"

import {
  adjustInventory,
  commitInventoryReservation,
  createInventoryReservation,
  releaseInventoryReservation,
} from "@/lib/server/inventory-client"
import type { InventorySummary } from "@/lib/types/inventory"

type BaseActionState = {
  status: "idle" | "success" | "error"
  message?: string
}

export type AdjustmentActionState = BaseActionState & {
  summary?: InventorySummary
}

export type ReservationActionState = BaseActionState & {
  details?: { expiresAt?: string | null; sku?: string; qty?: number }
}

const successResponse = <T extends BaseActionState>(payload: T): T => payload

const errorResponse = <T extends BaseActionState>(message: string): T =>
  ({
    status: "error",
    message,
  } as T)

export async function adjustInventoryAction(
  _prev: AdjustmentActionState,
  formData: FormData
): Promise<AdjustmentActionState> {
  const sku = formData.get("sku")?.toString().trim()
  const deltaRaw = formData.get("delta")?.toString() ?? "0"
  const reason = formData.get("reason")?.toString().trim()
  const referenceId = formData.get("referenceId")?.toString().trim()

  if (!sku) return errorResponse("SKU is required.")
  if (!reason) return errorResponse("Reason is required.")

  const delta = Number(deltaRaw)
  if (!Number.isFinite(delta) || delta === 0) {
    return errorResponse("Provide a non-zero numeric delta.")
  }

  try {
    const result = await adjustInventory({
      sku,
      delta,
      reason,
      referenceId: referenceId || undefined,
    })
    revalidatePath("/")
    return successResponse({
      status: "success",
      message: `Adjustment ${result.status} (${delta > 0 ? "+" : ""}${delta})`,
      summary: result.summary,
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Adjustment failed.")
  }
}

export async function createReservationAction(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const sku = formData.get("sku")?.toString().trim()
  const orderId = formData.get("orderId")?.toString().trim()
  const qtyRaw = formData.get("quantity")?.toString() ?? "0"
  const ttlRaw = formData.get("ttlSeconds")?.toString()

  if (!sku) return errorResponse("SKU is required.")
  if (!orderId) return errorResponse("Order ID is required.")

  const qty = Number(qtyRaw)
  if (!Number.isFinite(qty) || qty <= 0) {
    return errorResponse("Quantity must be greater than zero.")
  }

  const ttlSeconds = ttlRaw ? Number(ttlRaw) : undefined

  try {
    const response = await createInventoryReservation({
      orderId,
      items: [{ sku, qty }],
      ttlSeconds: ttlSeconds && ttlSeconds > 0 ? ttlSeconds : undefined,
    })

    if (response.status === "failed") {
      const reason =
        response.reason === "INSUFFICIENT_STOCK"
          ? "Insufficient stock for reservation."
          : "Invalid reservation payload."
      return errorResponse(reason)
    }

    revalidatePath("/")
    return successResponse({
      status: "success",
      message:
        response.status === "duplicate"
          ? "Duplicate reservation acknowledged."
          : "Reservation created.",
      details: {
        sku,
        qty,
        expiresAt: response.expiresAt,
      },
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Reservation request failed."
    )
  }
}

export async function commitReservationAction(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const orderId = formData.get("orderId")?.toString().trim()
  if (!orderId) return errorResponse("Order ID is required.")

  try {
    const response = await commitInventoryReservation(orderId)
    if (response.status === "noop") {
      return errorResponse("No active reservation for that order.")
    }

    revalidatePath("/")
    return successResponse({
      status: "success",
      message:
        response.status === "duplicate"
          ? "Reservation already committed."
          : "Reservation committed.",
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to commit reservation."
    )
  }
}

export async function releaseReservationAction(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const orderId = formData.get("orderId")?.toString().trim()
  const reason = formData.get("reason")?.toString().trim()
  if (!orderId) return errorResponse("Order ID is required.")

  try {
    const response = await releaseInventoryReservation(orderId, reason)
    if (response.status === "noop") {
      return errorResponse("No reservation found to release.")
    }

    revalidatePath("/")
    return successResponse({
      status: "success",
      message:
        response.status === "duplicate"
          ? "Reservation already released."
          : "Reservation released.",
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to release reservation."
    )
  }
}
