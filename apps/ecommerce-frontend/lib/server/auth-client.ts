import "server-only"

import { createAuthClient } from "better-auth/client"
import { inferAdditionalFields } from "better-auth/client/plugins"

import { env } from "@/env/server"
import {
  clearServiceAuthToken,
  setServiceAuthToken,
} from "@/lib/server/service-auth-context"

type RequestUrl = URL | string

function isSignOutRequest(url: RequestUrl) {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url
    return parsed.pathname.endsWith("/sign-out")
  } catch {
    return typeof url === "string" && url.includes("/sign-out")
  }
}

type TokenResponse = { token?: unknown }

export const authClient = createAuthClient({
  baseURL: env.BETTER_AUTH_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        roles: {
          input: false,
          required: true,
          type: "string[]",
        },
      },
    }),
  ],
  fetchOptions: {
    onSuccess(context) {
      const token = (context.data as TokenResponse | null | undefined)?.token
      if (typeof token === "string" && token.length > 0) {
        setServiceAuthToken(token)
      } else if (isSignOutRequest(context.request.url)) {
        clearServiceAuthToken()
      }
    },
  },
})
