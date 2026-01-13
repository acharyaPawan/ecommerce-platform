import "server-only"

import { headers } from "next/headers"

import { authClient } from "@/lib/server/auth-client"

export async function getSession() {
  return authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })
}
