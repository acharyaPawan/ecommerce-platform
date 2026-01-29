import "server-only"

import { headers } from "next/headers"
import {
  loadAuthConfig,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type VerifiedAuthTokenPayload,
} from "@ecommerce/core"

import { env } from "@/env/server"
import logger from "./logger"

type TokenResponse = {
  token?: unknown
}

const authConfig = loadAuthConfig({
  env: process.env,
  defaults: {
    issuer: "iam-svc",
    audience: "ecommerce-clients",
  },
  deriveJwksFromIam: {
    iamUrl: env.BETTER_AUTH_URL,
  },
})

let cachedVerifyOptions: ReturnType<typeof resolveVerifyAuthTokenOptions> | null = null

const getVerifyOptions = () => {
  if (!cachedVerifyOptions) {
    cachedVerifyOptions = resolveVerifyAuthTokenOptions(authConfig)
  }
  return cachedVerifyOptions
}

async function fetchAuthTokenFromSession(): Promise<string | null> {
  const requestHeaders = await headers()
  const cookieHeader = requestHeaders.get("cookie")
  if (!cookieHeader) {
    return null
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
    return null
  }

  try {
    const data = (await response.json()) as TokenResponse | null
    return typeof data?.token === "string" ? data.token : null
  } catch {
    return null
  }
}

export async function loadVerifiedAuthSession(): Promise<VerifiedAuthTokenPayload | null> {
  try {
    const token = await fetchAuthTokenFromSession()
    if (!token) {
      return null
    }
    const options = getVerifyOptions()
    return await verifyAuthToken(token, options)
  } catch (error) {
    logger.warn(`auth.session.verify.failed ${error}`);
    // logger.warn("auth.session.verify.failed", {
    //   message: (error as Error).message,
    // })
    return null
  }
}
