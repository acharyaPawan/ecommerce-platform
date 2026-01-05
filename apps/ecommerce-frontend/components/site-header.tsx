import type { Route } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NavLink = {
  href: { pathname: Route; hash?: string }
  label: string
}

const navLinks: NavLink[] = [
  { href: { pathname: "/", hash: "collections" }, label: "Collections" },
  { href: { pathname: "/", hash: "catalog" }, label: "Catalog" },
  { href: { pathname: "/", hash: "stories" }, label: "Field Notes" },
  { href: { pathname: "/", hash: "waitlist" }, label: "Programs" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Forma Supply
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={{ pathname: "/", hash: "stories" }}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Journal
          </Link>
          <Link
            href={{ pathname: "/", hash: "waitlist" }}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Book a fitting
          </Link>
        </div>
      </div>
    </header>
  )
}
