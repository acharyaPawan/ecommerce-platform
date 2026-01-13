import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

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
}

export const env = createEnv({
  server: {
    BETTER_AUTH_URL: z.url(),
    ...serviceEnvShape,
  },
  experimental__runtimeEnv: process.env,
})
