export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-20">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Legal</p>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy Overview</h1>
        <p className="text-base text-muted-foreground">
          We collect the minimum amount of data required to run the storefront preview experience. No payment details
          or sensitive information is stored on this surface.
        </p>
        <p className="text-base text-muted-foreground">
          For a full program agreement, please contact our team through the waitlist intake form so we can issue the
          master service documents tied to your deployment.
        </p>
      </div>
    </div>
  )
}
