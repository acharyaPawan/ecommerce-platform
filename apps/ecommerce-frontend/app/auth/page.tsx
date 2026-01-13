import Link from "next/link"

export default function AuthPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="surface space-y-4 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Sign in</p>
        <h1 className="text-3xl font-semibold">Account access</h1>
        <p className="text-sm text-muted">
          Manage your session so the storefront can call catalog, cart, and orders
          services with proper authorization.
        </p>
        <div className="space-x-3">
          <Link
            href="/auth/sign-in"
            className="accent-gradient inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-semibold"
          >
            Return to storefront
          </Link>
        </div>
      </div>
    </div>
  )
}
