import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t bg-background py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold">Forma Supply</p>
          <p className="text-sm text-muted-foreground">Objects for retail, hospitality, and flexible work.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/press" className="hover:text-foreground">
            Press
          </Link>
          <span className="text-muted-foreground/70">© {new Date().getFullYear()} Forma Supply</span>
        </div>
      </div>
    </footer>
  )
}
