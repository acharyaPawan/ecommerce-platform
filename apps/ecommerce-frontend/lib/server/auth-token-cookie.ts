import "server-only"

import { cookies } from "next/headers"

export const AUTH_TOKEN_COOKIE = "ecom_auth_token"

export async function readAuthTokenCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(AUTH_TOKEN_COOKIE)?.value
}

export function resolveJwtMaxAgeSeconds(token: string): number | undefined {
  const payload = token.split(".")[1]
  if (!payload) {
    return undefined
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    const exp = typeof decoded?.exp === "number" ? decoded.exp : undefined
    if (!exp) return undefined
    const now = Math.floor(Date.now() / 1000)
    const maxAge = exp - now
    return maxAge > 0 ? maxAge : undefined
  } catch {
    return undefined
  }
}
