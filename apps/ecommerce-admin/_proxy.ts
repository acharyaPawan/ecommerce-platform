import { NextResponse, type NextRequest } from "next/server"
import { authClient } from "./lib/auth-client"
import logger from "./lib/server/logger"

const PUBLIC_FILE = /\.(.*)$/
const PUBLIC_PATH_PREFIXES = ["/auth", "/api/auth", "/_next"]

type SessionResponse = {
  data?: {
    session?: { roles?: string[] | string }
    user?: { roles?: string[] | string }
  }
  session?: { roles?: string[] | string }
  user?: { roles?: string[] | string }
}

function isPublicPath(pathname: string) {
  if (PUBLIC_FILE.test(pathname)) return true
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function redirectToSignIn(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = "/auth/sign-in"
  redirectUrl.searchParams.set(
    "redirectTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  return NextResponse.redirect(redirectUrl)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    const { data } = await authClient.getSession()

    if (!data?.session) {
      return redirectToSignIn(request)
    }


    logger.debug({ hasSession: Boolean(data?.session) }, "admin.proxy.session.loaded")
    // const session = data?.session?.roles
    const rawRoles = data?.user.roles
    const roles = Array.isArray(rawRoles)
      ? rawRoles
      : typeof rawRoles === "string"
        ? [rawRoles]
        : []
    const hasAdminRole = roles.includes("admin")
    logger.debug({ hasAdminRole }, "admin.proxy.role.checked")

    if (!hasAdminRole) {
      return redirectToSignIn(request)
    }

    return NextResponse.next()
  } catch {
    return redirectToSignIn(request)
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
