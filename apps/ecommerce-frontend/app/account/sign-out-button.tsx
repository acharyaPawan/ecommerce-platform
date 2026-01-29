"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function SignOutButton() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSignOut = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        let message = `Sign out failed (${response.status})`
        try {
          const data = (await response.json()) as { message?: string; error?: string }
          message = data.message ?? data.error ?? message
        } catch {}
        setError(message)
        return
      }

      router.refresh()
      router.push("/")
    } catch (err) {
      setError((err as Error).message || "Sign out failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-semibold text-[color:var(--ink)]"
        type="button"
        onClick={onSignOut}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing out..." : "Sign out"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
