import "./env/client"
import { env } from "./env/server"
import path from "node:path";
import { ALLOWED_REMOTE_IMAGE_HOSTS } from "./lib/media-hosts";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${env.BETTER_AUTH_URL}/api/auth/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: ALLOWED_REMOTE_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  logging: {
    'fetches': {
      'fullUrl': true,
      'hmrRefreshes': true
    },
    incomingRequests: true
  }
};

export default nextConfig;
