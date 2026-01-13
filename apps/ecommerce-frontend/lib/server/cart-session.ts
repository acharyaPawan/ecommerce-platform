import "server-only"

import { cookies } from "next/headers"

const CART_ID_COOKIE = "ecom_cart_id"

export async function getCartId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(CART_ID_COOKIE)?.value
  } catch {
    return undefined
  }
}

export async function setCartId(cartId: string) {
  const cookieStore = await cookies()
  cookieStore.set(CART_ID_COOKIE, cartId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearCartId() {
  const cookieStore = await cookies()
  cookieStore.delete(CART_ID_COOKIE)
}
