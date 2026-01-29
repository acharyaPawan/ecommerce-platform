import { redirect } from "next/navigation"

import { loadVerifiedAuthSession } from "@/lib/server/auth-session"

import { SignOutButton } from "./sign-out-button"

export default async function AccountPage() {
  const session = await loadVerifiedAuthSession()
  if (!session) {
    redirect("/auth/sign-in")
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="surface space-y-8 p-10">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Account
          </p>
          <h1 className="text-3xl font-semibold">Your details</h1>
          <p className="text-sm text-muted">
            Manage your profile and review the claims attached to your session.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail label="Name" value={session.name ?? "—"} />
          <Detail label="Email" value={session.email} />
          <Detail label="User ID" value={session.userId} />
          <Detail label="Session ID" value={session.sessionId} />
          <Detail
            label="Email verified"
            value={session.emailVerified ? "Yes" : "No"}
          />
          <Detail label="Roles" value={session.roles.join(", ")} />
        </div>

        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted">
            Signed in with a JWT verified against IAM JWKS.
          </p>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="break-all text-sm font-medium text-[color:var(--ink)]">
        {value}
      </p>
    </div>
  )
}
