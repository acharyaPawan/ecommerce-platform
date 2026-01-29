import { NextRequest, NextResponse } from "next/server"

import { env } from "@/env/server"
import {
  AUTH_TOKEN_COOKIE,
  resolveJwtMaxAgeSeconds,
} from "@/lib/server/auth-token-cookie"

const sanitizeSetCookie = (value: string) => {
  return value
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => !segment.toLowerCase().startsWith("domain="))
    .join("; ")
}

const buildTargetUrl = (pathSegments: string[] | undefined, search: string) => {
  const hasSegments = pathSegments && pathSegments.length > 0
  const suffix = hasSegments ? `/${pathSegments.join("/")}` : ""
  const target = new URL(`/api/auth${suffix}`, env.BETTER_AUTH_URL)
  target.search = search
  return target
}

const forwardHeaders = (request: NextRequest) => {
  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    if (["host", "content-length"].includes(key.toLowerCase())) {
      continue
    }
    headers.set(key, value)
  }
  return headers
}

const proxyAuthRequest = async (
  request: NextRequest,
  params: { path?: string[] }
) => {
  const targetUrl = buildTargetUrl(params.path, request.nextUrl.search)
  const methodHasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())
  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: forwardHeaders(request),
    body: request.body,
    signal: request.signal,
    ...(methodHasBody ? { duplex: "half" as const } : {}),
  })

  const outgoingHeaders = new Headers()
  const setCookieValues: string[] = []

  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      setCookieValues.push(value)
      continue
    }
    outgoingHeaders.set(key, value)
  }

  for (const cookie of setCookieValues) {
    outgoingHeaders.append("set-cookie", sanitizeSetCookie(cookie))
  }

  outgoingHeaders.set("cache-control", "no-store")

  const pathKey = (params.path ?? []).join("/")
  const shouldSetTokenCookie = [
    "sign-in/email",
    "sign-up/email",
    "token",
  ].includes(pathKey)
  const shouldClearTokenCookie = pathKey === "sign-out"

  if (shouldSetTokenCookie) {
    try {
      const data = (await response.clone().json()) as { token?: unknown } | null
      const token = typeof data?.token === "string" ? data.token : undefined

      const nextResponse = NextResponse.json(data ?? null, {
        status: response.status,
        statusText: response.statusText,
        headers: outgoingHeaders,
      })

      if (token) {
        const maxAge = resolveJwtMaxAgeSeconds(token)
        nextResponse.cookies.set(AUTH_TOKEN_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          ...(maxAge ? { maxAge } : {}),
        })
      }

      return nextResponse
    } catch {
      // fall through to streaming response
    }
  }

  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outgoingHeaders,
  })

  if (shouldClearTokenCookie) {
    nextResponse.cookies.set(AUTH_TOKEN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }

  return nextResponse
}

const handler = async (
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) => {
  const resolvedParams = await context.params
  return proxyAuthRequest(request, resolvedParams ?? {})
}

export const dynamic = "force-dynamic"

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD }
