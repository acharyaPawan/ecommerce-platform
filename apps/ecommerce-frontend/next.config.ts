import type { NextConfig } from "next"

import { env } from "./env/server"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${env.BETTER_AUTH_URL}/api/auth/:path*`,
      },
    ]
  },
  typedRoutes: true,
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
    incomingRequests: true,
  },
}

export default nextConfig
