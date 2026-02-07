import { getShipment } from "@/lib/server/fulfillment-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"

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
  let shipment = null
  if (orderId) {
    try {
      shipment = await withServiceAuthFromRequest(async () => getShipment(orderId))
    } catch {
      shipment = null
    }
  }

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
        <p className="text-sm text-muted">
          You can review order details on the checkout page after placing an
          order, or sign in to view your account history.
        </p>
      </div>
    </div>
  )
}
