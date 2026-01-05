import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import { serverEnv } from "@/lib/env"

const connectionString = serverEnv.DATABASE_URL

const pool = connectionString ? new Pool({ connectionString }) : undefined

export const db = pool ? drizzle(pool, { logger: process.env.NODE_ENV === "development" }) : undefined

export type DatabaseClient = typeof db
