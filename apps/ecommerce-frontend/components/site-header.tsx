import Link from "next/link"
import { ShoppingBag, User2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { getCartId } from "@/lib/server/cart-session"
import { loadVerifiedAuthSession } from "@/lib/server/auth-session"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"
import { getCart } from "@/lib/server/cart-client"
import { cn } from "@/lib/utils"

async function loadCartCount() {
  const cartId = await getCartId()
  if (!cartId) return 0

  return withServiceAuthFromRequest(async () => {
    const cart = await getCart(cartId)
    return cart?.totals.totalQuantity ?? 0
  })
}

export async function SiteHeader() {
  const [cartCount, authSession] = await Promise.all([
    loadCartCount(),
    loadVerifiedAuthSession(),
  ])
  const signedIn = Boolean(authSession?.userId)
  console.log("Auth Session:", authSession, signedIn)
  const accountName = authSession?.name ?? "Account"

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--canvas)]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent)] text-sm font-semibold text-white">
              AM
            </span>
            <div className="leading-tight">
              <p className="text-lg font-semibold">Aurora Market</p>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Curated goods
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <Link href="/" className="transition hover:text-[color:var(--ink)]">
              Shop
            </Link>
            <Link href="/cart" className="transition hover:text-[color:var(--ink)]">
              Cart
            </Link>
            <Link href="/checkout" className="transition hover:text-[color:var(--ink)]">
              Checkout
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="relative flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--accent)] px-2 text-xs font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            href={{ pathname: signedIn ? "/account" : "/auth/sign-in" }}
            className={cn(
              buttonVariants({
                variant: signedIn ? "secondary" : "primary",
                size: "sm",
              }),
              "hidden md:inline-flex"
            )}
          >
            <User2 className="h-4 w-4" />
            {signedIn ? accountName : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  )
}
