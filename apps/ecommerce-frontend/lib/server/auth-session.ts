import { cookies, headers } from "next/headers"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"

export type StarterSession = {
  session?: {
    user?: {
      name?: string | null
    }
  }
  user?: {
    name?: string | null
  }
}

export async function loadAuthSession(): Promise<StarterSession | null> {
  // const cookieStore = cookies()
  // const cookieHeader = cookieStore.toString()
  const url = new URL("/api/auth/get-session", APP_URL)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: await headers(),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  try {
    return (await response.json()) as StarterSession
  } catch {
    return null
  }
}
