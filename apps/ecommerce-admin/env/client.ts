import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";
 
export const env = createEnv({
  client: {
    NEXT_PUBLIC_GATEWAY_BASE_URL: z.string(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_GATEWAY_BASE_URL: process.env.NEXT_PUBLIC_GATEWAY_BASE_URL,
  },
});