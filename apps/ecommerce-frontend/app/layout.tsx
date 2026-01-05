import type { Metadata } from "next"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { NuqsAdapter } from 'nuqs/adapters/next/app'


import "./globals.css"

export const metadata: Metadata = {
  title: "Forma Supply — Commerce OS for physical retail",
  description:
    "A modern storefront that merchandises catalog, collections, and services for the ecommerce platform.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <NuqsAdapter>
        <SiteHeader />
        <main className="min-h-screen bg-background">{children}</main>
        <SiteFooter />
        </NuqsAdapter>
      </body>
    </html>
  )
}
