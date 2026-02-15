import { getShipment } from "@/lib/server/fulfillment-client"
import { getOrder } from "@/lib/server/orders-client"
import { getPaymentsForOrder } from "@/lib/server/payments-client"
import { ServiceRequestError } from "@/lib/server/service-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import type { PaymentRecord } from "@/lib/types/payments"
import Link from "next/link"

export const dynamic = "force-dynamic"

type OrderConfirmationPageProps = {
  searchParams?: Promise<{
    orderId?: string
  }>
}

export default async function OrderConfirmationPage({
  searchParams,
}: OrderConfirmationPageProps) {
  const params = await searchParams
  const orderId = params?.orderId?.trim()
  let order = null as Awaited<ReturnType<typeof getOrder>>
  let payments = null as Awaited<ReturnType<typeof getPaymentsForOrder>>
  let shipment = null as Awaited<ReturnType<typeof getShipment>>
  let orderUnavailable = false
  let orderRestricted = false
  let paymentsUnavailable = false
  if (orderId) {
    await withServiceAuthFromRequest(async () => {
      const [orderResult, paymentsResult, shipmentResult] = await Promise.allSettled([
        getOrder(orderId),
        getPaymentsForOrder(orderId),
        getShipment(orderId),
      ])

      if (orderResult.status === "fulfilled") {
        order = orderResult.value
      } else {
        order = null
        const error = orderResult.reason
        if (
          error instanceof ServiceRequestError &&
          (error.status === 401 || error.status === 403)
        ) {
          orderRestricted = true
        } else {
          orderUnavailable = true
        }
      }

      if (orderRestricted) {
        return
      }

      if (paymentsResult.status === "fulfilled") {
        payments = paymentsResult.value
      } else {
        payments = null
        paymentsUnavailable = true
      }

      if (shipmentResult.status === "fulfilled") {
        shipment = shipmentResult.value
      } else {
        shipment = null
      }
    })
  }

  const orderStatus = order?.status ?? null
  const orderMissing = Boolean(
    orderId && !orderStatus && !orderRestricted && !orderUnavailable
  )
  const inventory = orderRestricted
    ? {
        state: "unknown" as const,
        label: "Restricted",
        description: "Sign in with the order owner account to view inventory state.",
      }
    : orderMissing
      ? {
          state: "unknown" as const,
          label: "Unavailable",
          description: "Order not found.",
        }
      : deriveInventoryStatus(orderStatus, order?.cancellationReason, orderUnavailable)
  const payment = orderRestricted
    ? {
        state: "unknown" as const,
        label: "Restricted",
        description: "Sign in with the order owner account to view payment state.",
      }
    : orderMissing
      ? {
          state: "unknown" as const,
          label: "Unavailable",
          description: "Order not found.",
        }
      : derivePaymentStatus(payments, paymentsUnavailable)
  const fulfillment = orderRestricted
    ? {
        state: "pending" as const,
        label: "Restricted",
        description: "Sign in with the order owner account to view fulfillment state.",
      }
    : orderMissing
      ? {
          state: "pending" as const,
          label: "Unavailable",
          description: "Order not found.",
        }
      : deriveFulfillmentStatus(shipment)
  const overall = orderRestricted
    ? {
        label: "Restricted",
        description: "Order details are private. Sign in to continue.",
      }
    : orderMissing
      ? {
          label: "Order not found",
          description: "This order ID does not exist or is no longer available.",
        }
      : deriveOverallStatus(inventory.state, payment.state, fulfillment.state)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="surface space-y-4 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Order confirmation
        </p>
        <h1 className="text-3xl font-semibold">Thank you for your order</h1>
        {orderId ? (
          <p className="text-sm text-muted">Order ID {orderId}</p>
        ) : null}
        {orderStatus ? (
          <div className="mx-auto w-full max-w-xl rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Order status
            </p>
            <p className="text-base font-semibold">
              {renderOrderStatusLabel(orderStatus)}
            </p>
            <p className="text-sm text-muted">
              {renderOrderStatusDescription(orderStatus)}
            </p>
            {order?.cancellationReason ? (
              <p className="mt-2 text-xs text-muted">
                Reason: {order.cancellationReason}
              </p>
            ) : null}
          </div>
        ) : orderRestricted ? (
          <div className="mx-auto w-full max-w-xl rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Order status
            </p>
            <p className="text-base font-semibold">Restricted</p>
            <p className="text-sm text-muted">
              Sign in with the account that placed this order to view its status.
            </p>
          </div>
        ) : orderMissing ? (
          <div className="mx-auto w-full max-w-xl rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Order status
            </p>
            <p className="text-base font-semibold">Not found</p>
            <p className="text-sm text-muted">
              This order ID does not exist.
            </p>
          </div>
        ) : orderId ? (
          <div className="mx-auto w-full max-w-xl rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Order status
            </p>
            <p className="text-base font-semibold">Unavailable</p>
            <p className="text-sm text-muted">
              Could not fetch order details from orders service.
            </p>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-xl space-y-3 rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Workflow state
          </p>
          <StatusRow
            label="Overall"
            value={overall.label}
            description={overall.description}
          />
          <StatusRow
            label="Inventory"
            value={inventory.label}
            description={inventory.description}
          />
          <StatusRow
            label="Payment"
            value={payment.label}
            description={payment.description}
          />
          <StatusRow
            label="Fulfillment"
            value={fulfillment.label}
            description={fulfillment.description}
          />
        </div>
        {shipment ? (
          <div className="mx-auto w-full max-w-xl space-y-2 rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Fulfillment
            </p>
            <p className="text-sm">
              <span className="font-semibold">Status:</span> {shipment.status}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Carrier:</span> {shipment.carrier}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Tracking:</span>{" "}
              <a
                href={shipment.trackingUrl}
                className="underline decoration-dotted underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {shipment.trackingNumber}
              </a>
            </p>
            <p className="text-sm text-muted">
              Delivered {new Date(shipment.deliveredAt).toLocaleString()}
            </p>
          </div>
        ) : null}
        {payments && payments.length > 0 ? (
          <div className="mx-auto w-full max-w-xl space-y-2 rounded-xl border border-[color:var(--line)] bg-white/70 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Payments
            </p>
            {payments.slice(0, 3).map((record) => (
              <div key={record.id} className="text-sm">
                <p>
                  <span className="font-semibold">Status:</span> {record.status}
                </p>
                <p className="text-muted">
                  Updated {new Date(record.updatedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted">
          Your cart is cleared after checkout. Continue shopping, or sign in to
          your account.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Link
            href="/"
            className="accent-gradient inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            Continue shopping
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--ink)]"
          >
            Go to account
          </Link>
        </div>
      </div>
    </div>
  )
}

function renderOrderStatusLabel(status: string): string {
  switch (status) {
    case "pending_inventory":
      return "Pending inventory confirmation"
    case "confirmed":
      return "Confirmed"
    case "rejected":
      return "Could not be fulfilled"
    case "canceled":
      return "Canceled"
    default:
      return status
  }
}

function StatusRow({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-[color:var(--line)] px-3 py-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-xs text-muted">{description}</p>
    </div>
  )
}

function deriveInventoryStatus(
  orderStatus: string | null,
  cancellationReason: string | null | undefined,
  orderUnavailable: boolean
): { state: "pending" | "confirmed" | "failed" | "unknown"; label: string; description: string } {
  if (orderStatus === "pending_inventory") {
    return {
      state: "pending",
      label: "Pending",
      description: "Waiting for inventory reservation event.",
    }
  }
  if (orderStatus === "confirmed") {
    return {
      state: "confirmed",
      label: "Reserved",
      description: "Inventory reservation succeeded.",
    }
  }
  if (
    orderStatus === "rejected" ||
    (cancellationReason && cancellationReason.startsWith("inventory:"))
  ) {
    return {
      state: "failed",
      label: "Failed",
      description: "Inventory reservation failed (insufficient stock).",
    }
  }
  if (orderUnavailable) {
    return {
      state: "unknown",
      label: "Unknown",
      description: "Could not read inventory state from orders service.",
    }
  }
  return {
    state: "unknown",
    label: "Unknown",
    description: "No inventory state available.",
  }
}

function derivePaymentStatus(
  payments: PaymentRecord[] | null,
  paymentsUnavailable: boolean
): { state: "none" | "authorized" | "captured" | "failed" | "unknown"; label: string; description: string } {
  if (paymentsUnavailable || payments === null) {
    return {
      state: "unknown",
      label: "Unknown",
      description: "Could not load payment service.",
    }
  }
  if (payments.length === 0) {
    return {
      state: "none",
      label: "Not started",
      description: "No payment record exists for this order yet.",
    }
  }

  const latest = [...payments].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]
  if (latest.status === "captured") {
    return {
      state: "captured",
      label: "Captured",
      description: "Payment has been captured.",
    }
  }
  if (latest.status === "authorized") {
    return {
      state: "authorized",
      label: "Authorized",
      description: "Payment authorized; capture may still be pending.",
    }
  }
  return {
    state: "failed",
    label: "Failed",
    description: latest.failureReason
      ? `Payment failed: ${latest.failureReason}`
      : "Payment failed.",
  }
}

function deriveFulfillmentStatus(
  shipment: Awaited<ReturnType<typeof getShipment>>
): { state: "done" | "pending"; label: string; description: string } {
  if (!shipment) {
    return {
      state: "pending",
      label: "Not created",
      description: "Shipment is not available yet.",
    }
  }
  return {
    state: "done",
    label: "Fulfilled",
    description: `Shipment ${shipment.shipmentId} is ${shipment.status}.`,
  }
}

function deriveOverallStatus(
  inventoryState: "pending" | "confirmed" | "failed" | "unknown",
  paymentState: "none" | "authorized" | "captured" | "failed" | "unknown",
  fulfillmentState: "done" | "pending"
): { label: string; description: string } {
  if (inventoryState === "unknown" || paymentState === "unknown") {
    return {
      label: "Unknown",
      description:
        "Core workflow states are unavailable. Verify orders/payments services and auth context.",
    }
  }
  if (inventoryState === "failed") {
    return {
      label: "Blocked",
      description: "Order cannot proceed because inventory reservation failed.",
    }
  }
  if (inventoryState === "pending") {
    return {
      label: "In progress",
      description: "Waiting for inventory confirmation.",
    }
  }
  if (paymentState === "failed") {
    return {
      label: "Blocked",
      description: "Payment failed after inventory confirmation.",
    }
  }
  if (paymentState === "none") {
    return {
      label: "In progress",
      description: "Inventory is confirmed; payment has not started.",
    }
  }
  if (fulfillmentState === "done") {
    return {
      label: "Completed",
      description: "Order has reached fulfillment.",
    }
  }
  return {
    label: "In progress",
    description: "Core checks passed; downstream processing may still be running.",
  }
}

function renderOrderStatusDescription(status: string): string {
  switch (status) {
    case "pending_inventory":
      return "We are waiting for inventory to confirm stock reservation."
    case "confirmed":
      return "Inventory has confirmed reservation for this order."
    case "rejected":
      return "Inventory could not reserve stock for one or more items."
    case "canceled":
      return "This order was canceled."
    default:
      return "Order state has been recorded."
  }
}
