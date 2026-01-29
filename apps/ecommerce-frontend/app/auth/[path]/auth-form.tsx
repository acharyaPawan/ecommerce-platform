"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type AuthMode = "sign-in" | "sign-up"

type AuthResponse = {
  message?: string
  error?: string
}

const resolveEndpoint = (mode: AuthMode) =>
  mode === "sign-in" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email"

const resolveTitle = (mode: AuthMode) =>
  mode === "sign-in" ? "Welcome back" : "Create your account"

const resolveSubtitle = (mode: AuthMode) =>
  mode === "sign-in"
    ? "Sign in with the email and password linked to your account."
    : "Sign up with your name, email, and a password to get started."

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const payload =
      mode === "sign-in"
        ? { email, password, rememberMe }
        : { name, email, password, rememberMe, callbackURL: "/" }

    try {
      const response = await fetch(resolveEndpoint(mode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
        cache: "no-store",
      })

      if (!response.ok) {
        let message = `Request failed (${response.status})`
        try {
          const data = (await response.json()) as AuthResponse
          message = data.message ?? data.error ?? message
        } catch {}
        setError(message)
        setIsSubmitting(false)
        return
      }

      router.refresh()
      router.push("/")
    } catch (err) {
      setError((err as Error).message || "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="surface space-y-6 p-8 md:p-10">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            {mode === "sign-in" ? "Sign in" : "Sign up"}
          </p>
          <h1 className="text-3xl font-semibold">{resolveTitle(mode)}</h1>
          <p className="text-sm text-muted">{resolveSubtitle(mode)}</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "sign-up" && (
            <label className="block text-sm font-medium">
              Name
              <input
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm"
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
          )}

          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm"
              type="password"
              name="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember this device
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            className="accent-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Working..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="text-center text-xs text-muted">
          {mode === "sign-in" ? (
            <>
              New here?{" "}
              <Link
                className="font-semibold text-[color:var(--ink)]"
                href="/auth/sign-up"
              >
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                className="font-semibold text-[color:var(--ink)]"
                href="/auth/sign-in"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
