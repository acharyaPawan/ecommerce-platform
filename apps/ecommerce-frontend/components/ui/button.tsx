import type { ButtonHTMLAttributes } from "react"

import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-glow)] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "accent-gradient text-white shadow-lg shadow-[color:var(--accent-glow)]/30 hover:-translate-y-0.5",
        secondary:
          "border-[color:var(--line)] bg-white/90 text-[color:var(--ink)] hover:-translate-y-0.5",
        ghost: "border-transparent text-[color:var(--ink)] hover:bg-white/60",
      },
      size: {
        sm: "px-4 py-1.5 text-xs",
        md: "px-5 py-2 text-sm",
        lg: "px-6 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export type { ButtonProps }
export { buttonVariants }
