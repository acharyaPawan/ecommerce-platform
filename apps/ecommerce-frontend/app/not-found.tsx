import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
      <div className="surface space-y-4 p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Page not found
        </p>
        <h1 className="text-3xl font-semibold">We could not find that page</h1>
        <p className="text-sm text-muted">
          The catalog might have moved. Head back to the storefront to explore.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
        >
          Return to shop
        </Link>
      </div>
    </div>
  )
}
