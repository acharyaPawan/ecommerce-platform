import "server-only"

import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"

const ANALYTICS_SESSION_COOKIE = "ecom_analytics_session"
const ANALYTICS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export async function getAnalyticsSessionId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(ANALYTICS_SESSION_COOKIE)?.value
  } catch {
    return undefined
  }
}

export async function getOrCreateAnalyticsSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(ANALYTICS_SESSION_COOKIE)?.value?.trim()
  if (existing) {
    return existing
  }

  const created = randomUUID()
  cookieStore.set(ANALYTICS_SESSION_COOKIE, created, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: ANALYTICS_SESSION_MAX_AGE_SECONDS,
  })
  return created
}
