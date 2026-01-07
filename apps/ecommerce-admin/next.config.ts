import "./env/client"
import { env } from "./env/server"

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${env.BETTER_AUTH_URL}/api/auth/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  logging: {
    'fetches': {
      'fullUrl': true
    },
    incomingRequests: true
  }
};

export default nextConfig;
