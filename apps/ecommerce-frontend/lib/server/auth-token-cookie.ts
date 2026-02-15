import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { env } from "@/env/server"

export const AUTH_TOKEN_COOKIE = "ecom_auth_token"

async function readAuthTokenCookieImpl(): Promise<string | undefined> {
  const store = await cookies()
  const token = store.get(AUTH_TOKEN_COOKIE)?.value

  if (isUsableJwt(token)) {
    return token
  }

  if (isJwtShape(token)) {
    const minted = await mintTokenFromSessionCookies(store)
    return minted ?? token
  }

  const minted = await mintTokenFromSessionCookies(store)
  return minted
}

export const readAuthTokenCookie = cache(readAuthTokenCookieImpl)

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

function isUsableJwt(token: string | undefined): token is string {
  if (!isJwtShape(token)) {
    return false
  }

  const maxAge = resolveJwtMaxAgeSeconds(token)
  if (maxAge === undefined) {
    return true
  }

  return maxAge > 30
}

function isJwtShape(token: string | undefined): token is string {
  return Boolean(token && token.split(".").length === 3)
}

async function mintTokenFromSessionCookies(
  store: Awaited<ReturnType<typeof cookies>>
): Promise<string | undefined> {
  const cookieHeader = store
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ")

  if (!cookieHeader) {
    return undefined
  }

  try {
    const target = new URL("/api/auth/token", env.BETTER_AUTH_URL)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    let response: Response
    try {
      response = await fetch(target, {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      return undefined
    }

    const payload = (await response.json()) as { token?: unknown } | null
    const token = typeof payload?.token === "string" ? payload.token : undefined
    return token && token.split(".").length === 3 ? token : undefined
  } catch {
    return undefined
  }
}
