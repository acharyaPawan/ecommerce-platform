import { AuthView } from "@daveyplate/better-auth-ui"
import { authViewPaths } from "@daveyplate/better-auth-ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4 py-12">
      <div className="surface w-full max-w-md p-8">
        <AuthView path={path} redirectTo="/" />
      </div>
    </main>
  )
}
