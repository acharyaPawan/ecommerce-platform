import "server-only"

import { headers } from "next/headers"

import { authClient } from "@/lib/server/auth-client"
import { withServiceAuthToken } from "@/lib/server/service-auth-context"

export async function getServiceAuthTokenFromRequest(): Promise<string | undefined> {
  const requestHeaders = await headers()
  const { data } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })
  const token = data?.session?.token
  return typeof token === "string" && token.length > 0 ? token : undefined
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await getServiceAuthTokenFromRequest()
  return withServiceAuthToken(token, callback)
}
