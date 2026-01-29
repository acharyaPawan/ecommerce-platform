import { notFound } from "next/navigation"

import { AuthForm } from "./auth-form"

const AUTH_PATHS = ["sign-in", "sign-up"] as const
type AuthPath = (typeof AUTH_PATHS)[number]

export const dynamicParams = false

export function generateStaticParams() {
  return AUTH_PATHS.map((path) => ({ path }))
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: AuthPath }>
}) {
  const { path } = await params
  if (!AUTH_PATHS.includes(path)) {
    notFound()
  }

  return (
    <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
      <AuthForm mode={path} />
    </main>
  )
}
