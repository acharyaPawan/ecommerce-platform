import "server-only"

import { cookies } from "next/headers"

const CART_ID_COOKIE = "ecom_cart_id"

export function getCartId(): string | undefined {
  return cookies().get(CART_ID_COOKIE)?.value
}

export function setCartId(cartId: string) {
  cookies().set(CART_ID_COOKIE, cartId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearCartId() {
  cookies().delete(CART_ID_COOKIE)
}
