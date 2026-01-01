import { ReactNode } from "react"

import { cn } from "@/lib/utils"

type StorefrontShellProps = {
  children: ReactNode
  className?: string
}

export function StorefrontShell({ children, className }: StorefrontShellProps) {
  return (
    <section
      className={cn(
        "relative w-full border-x border-border/60 bg-gradient-to-b from-background via-background to-background/60",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 sm:py-16">{children}</div>
    </section>
  )
}
