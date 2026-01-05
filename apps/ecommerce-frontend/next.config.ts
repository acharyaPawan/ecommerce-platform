import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    hmrRefreshes: true
    },
    incomingRequests: true
  }
}

export default nextConfig
