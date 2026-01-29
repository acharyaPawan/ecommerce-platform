import "server-only"

import { withServiceAuthToken } from "@/lib/server/service-auth-context"
import { readAuthTokenCookie } from "@/lib/server/auth-token-cookie"

async function fetchAuthTokenFromSession(): Promise<string | undefined> {
  return await readAuthTokenCookie()
}

export async function withServiceAuthFromRequest<T>(
  callback: () => Promise<T>
): Promise<T> {
  const token = await fetchAuthTokenFromSession()
  return withServiceAuthToken(token, callback)
}
