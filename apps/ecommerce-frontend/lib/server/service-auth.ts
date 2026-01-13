import "server-only"

import { headers } from "next/headers"

import { authClient } from "@/lib/server/auth-client"
import { withServiceAuthToken } from "@/lib/server/service-auth-context"

export async function getServiceAuthTokenFromRequest(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers()
    const { data } = await authClient.token({
      fetchOptions: {
        headers: requestHeaders,
      },
    })
    return typeof data?.token === "string" && data.token.length > 0
      ? data.token
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
