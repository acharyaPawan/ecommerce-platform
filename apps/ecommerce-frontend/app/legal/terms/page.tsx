export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-20">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Legal</p>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-base text-muted-foreground">
          This frontend is a demo environment that mirrors the capabilities of the ecommerce platform. All pricing and
          product details are fictional and should not be treated as commercial offers.
        </p>
        <p className="text-base text-muted-foreground">
          Accessing the private programs or interacting with server actions represents consent to our actual MSA, which
          governs the managed deployment of Forma Supply.
        </p>
      </div>
    </div>
  )
}
