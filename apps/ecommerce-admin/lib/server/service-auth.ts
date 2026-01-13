import "server-only"

import { headers } from "next/headers"

import { withServiceAuthToken } from "@/lib/server/service-auth-context"
import { env } from "@/env/server"

export async function getServiceAuthTokenFromRequest(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers()
    const cookie = requestHeaders.get("cookie")
    if (!cookie) return undefined

    const tokenUrl = new URL("/api/auth/token", env.BETTER_AUTH_URL)
    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        cookie,
      },
      cache: "no-store",
    })

    if (!response.ok) return undefined
    const payload = (await response.json()) as { token?: string }
    return typeof payload.token === "string" && payload.token.length > 0
      ? payload.token
      : undefined
  } catch {
    return undefined
  }
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await getServiceAuthTokenFromRequest()
  return withServiceAuthToken(token, callback)
}
