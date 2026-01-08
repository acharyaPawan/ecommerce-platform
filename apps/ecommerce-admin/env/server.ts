import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const serviceEnvShape = {
  SERVICE_IAM_URL: z.string().url().optional(),
  SERVICE_IAM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_CATALOG_URL: z.string().url().optional(),
  SERVICE_CATALOG_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_INVENTORY_URL: z.string().url().optional(),
  SERVICE_INVENTORY_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_CART_URL: z.string().url().optional(),
  SERVICE_CART_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_ORDERS_URL: z.string().url().optional(),
  SERVICE_ORDERS_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_ORDERS_READ_URL: z.string().url().optional(),
  SERVICE_ORDERS_READ_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_PAYMENTS_URL: z.string().url().optional(),
  SERVICE_PAYMENTS_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_PAYMENTS_READ_URL: z.string().url().optional(),
  SERVICE_PAYMENTS_READ_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SERVICE_FULFILLMENT_URL: z.string().url().optional(),
  SERVICE_FULFILLMENT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
};

export const env = createEnv({
  server: {
    DATABASE_URL: z.url().optional(),
    BETTER_AUTH_URL: z.url(),
    // BETTER_AUTH_SECRET: z.string()
    ...serviceEnvShape,
  },
  // If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
  // runtimeEnv: {
  //   DATABASE_URL: process.env.DATABASE_URL,
  //   OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
  // },
  // For Next.js >= 13.4.4, you can just reference process.env:
  experimental__runtimeEnv: process.env
});
