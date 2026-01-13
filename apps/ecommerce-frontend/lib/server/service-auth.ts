import "server-only"

import { withServiceAuthToken } from "@/lib/server/service-auth-context"

export async function getServiceAuthTokenFromRequest(): Promise<string | undefined> {
  return undefined
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await getServiceAuthTokenFromRequest()
  return withServiceAuthToken(token, callback)
}
