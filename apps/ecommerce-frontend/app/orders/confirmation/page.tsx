export const dynamic = "force-dynamic"

export default function OrderConfirmationPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="surface space-y-4 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Order confirmation
        </p>
        <h1 className="text-3xl font-semibold">Thank you for your order</h1>
        <p className="text-sm text-muted">
          You can review order details on the checkout page after placing an
          order, or sign in to view your account history.
        </p>
      </div>
    </div>
  )
}
