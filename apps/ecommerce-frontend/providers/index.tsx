"use client"

import { AuthUIProvider } from "@daveyplate/better-auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"

import { authClient } from "@/lib/auth-client"

type AuthLinkProps = Omit<ComponentProps<typeof Link>, "href">

function AuthLink({ href, ...rest }: { href: string } & AuthLinkProps) {
  return <Link href={href as ComponentProps<typeof Link>["href"]} {...rest} />
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter()

  const handleNavigate = (href: string) =>
    router.push(href as Parameters<typeof router.push>[0])
  const handleReplace = (href: string) =>
    router.replace(href as Parameters<typeof router.replace>[0])

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={handleNavigate}
      replace={handleReplace}
      onSessionChange={() => router.refresh()}
      Link={AuthLink}
    >
      {children}
    </AuthUIProvider>
  )
}
