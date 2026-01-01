import type { Metadata } from "next"
import { Geist, Geist_Mono, Figtree } from "next/font/google"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

import "./globals.css"

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Forma Supply — Commerce OS for physical retail",
  description:
    "A modern storefront that merchandises catalog, collections, and services for the ecommerce platform.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}>
        <SiteHeader />
        <main className="min-h-screen bg-background">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
