import "server-only"

import { headers } from "next/headers"

import { env } from "@/env/server"
import { withServiceAuthToken } from "@/lib/server/service-auth-context"

type TokenResponse = {
  token?: unknown
}

async function fetchAuthTokenFromSession(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers()
    const cookieHeader = requestHeaders.get("cookie")
    if (!cookieHeader) {
      return undefined
    }

    const url = new URL("/api/auth/token", env.BETTER_AUTH_URL)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return undefined
    }

    const data = (await response.json()) as TokenResponse | null
    const token = typeof data?.token === "string" ? data.token : undefined
    return token
  } catch {
    return undefined
  }
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await fetchAuthTokenFromSession()
  return withServiceAuthToken(token, callback)
}
