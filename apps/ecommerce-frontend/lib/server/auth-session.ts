import "server-only"

import {
  loadAuthConfig,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type VerifiedAuthTokenPayload,
} from "@ecommerce/core"

import { env } from "@/env/server"
import { readAuthTokenCookie } from "@/lib/server/auth-token-cookie"
import logger from "./logger"

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

export async function loadVerifiedAuthSession(): Promise<VerifiedAuthTokenPayload | null> {
  try {
    const token = await readAuthTokenCookie()
    if (!token) {
      return null
    }
    const options = getVerifyOptions()
    return await verifyAuthToken(token, options)
  } catch (error) {
    logger.warn(`auth.session.verify.failed: ${(error as Error).message}`)
    return null
  }
}
