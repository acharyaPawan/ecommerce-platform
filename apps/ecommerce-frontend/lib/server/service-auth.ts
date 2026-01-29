import "server-only"

import { withServiceAuthToken } from "@/lib/server/service-auth-context"
import { readAuthTokenCookie } from "@/lib/server/auth-token-cookie"

async function fetchAuthTokenFromSession(): Promise<string | undefined> {
  const token = await readAuthTokenCookie()
  if (!token) {
    return undefined
  }
  return token.split(".").length === 3 ? token : undefined
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await fetchAuthTokenFromSession()
  return withServiceAuthToken(token, callback)
}
