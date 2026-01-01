import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import { serverEnv } from "@/lib/env"

const connectionString = serverEnv.DATABASE_URL

export const db = connectionString
  ? drizzle(neon(connectionString), { logger: process.env.NODE_ENV === "development" })
  : undefined

export type DatabaseClient = typeof db
