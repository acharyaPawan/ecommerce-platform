"use client"

import { useFormStatus } from "react-dom"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SubmitButtonProps = ButtonProps & {
  pendingLabel?: string
}

export function SubmitButton({
  children,
  pendingLabel = "Working...",
  className,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      className={cn(pending && "cursor-wait", className)}
      disabled={pending || props.disabled}
      type={type}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  )
}
