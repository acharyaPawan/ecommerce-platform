"use client"

import { useState, useTransition } from "react"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { addToCartAction } from "../../server/mutation/add-to-cart"

type AddToCartButtonProps = {
  productId: string
  quantity?: number
}

export function AddToCartButton({ productId, quantity = 1 }: AddToCartButtonProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      try {
        await addToCartAction({ productId, quantity })
        setStatus("success")
      } catch (error) {
        console.error(error)
        setStatus("error")
      } finally {
        setTimeout(() => setStatus("idle"), 3500)
      }
    })
  }

  return (
    <div className="w-full space-y-2">
      <Button onClick={handleClick} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Adding
          </>
        ) : (
          "Add to build list"
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        {status === "success"
          ? "Saved to your session cart."
          : status === "error"
            ? "Could not reach the cart service."
            : "No payment required until production lock."}
      </p>
    </div>
  )
}
