import Link from "next/link"

import { Button } from "@/components/ui/button"

const navLinks = [
  { href: "#collections", label: "Collections" },
  { href: "#catalog", label: "Catalog" },
  { href: "#stories", label: "Field Notes" },
  { href: "#waitlist", label: "Programs" },
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
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="#stories">Journal</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="#waitlist">Book a fitting</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
