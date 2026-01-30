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
  console.log("Got orderId as:", orderId)
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
        <p className="text-sm text-muted">
          You can review order details on the checkout page after placing an
          order, or sign in to view your account history.
        </p>
      </div>
    </div>
  )
}
