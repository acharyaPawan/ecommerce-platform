import { z } from "zod"

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  GATEWAY_BASE_URL: z.string().url().optional(),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_GATEWAY_BASE_URL: z.string().url().optional(),
})

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL,
})

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_GATEWAY_BASE_URL: process.env.NEXT_PUBLIC_GATEWAY_BASE_URL,
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>

export function getGatewayOrigin() {
  return (
    serverEnv.GATEWAY_BASE_URL ??
    clientEnv.NEXT_PUBLIC_GATEWAY_BASE_URL ??
    process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ??
    ""
  )
}
