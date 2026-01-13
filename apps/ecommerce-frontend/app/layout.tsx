import type { ReactNode } from "react"
import type { Metadata } from "next"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Aurora Market",
  description:
    "Shop curated essentials with a calm, craft-driven storefront built on the ecommerce platform.",
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[color:var(--canvas)] text-[color:var(--ink)]">
        <div className="relative min-h-screen overflow-hidden">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(circle_at_center,var(--glow)_0%,transparent_65%)] opacity-70 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-[320px] w-[320px] translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-glow)_0%,transparent_60%)] opacity-70 blur-2xl"
            aria-hidden
          />
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  )
}
