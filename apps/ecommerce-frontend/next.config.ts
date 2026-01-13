import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
