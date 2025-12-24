import { hc } from "hono/client";
import type { AppType } from "../app"; // Your Hono app type

const authUrl = process.env.BETTER_AUTH ?? 'http://localhost:3000';

export const client = hc<AppType>(authUrl, {
  init: {
    credentials: "include", // Required for sending cookies cross-origin
  },
});