import "./env/client"
import "./env/server"

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
