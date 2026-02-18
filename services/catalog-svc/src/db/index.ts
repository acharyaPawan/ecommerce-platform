import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as net from "node:net";
import { Pool } from "pg";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

//This disables problematic auto family selection before PG pool init:
net.setDefaultAutoSelectFamily(false)
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, {
  schema,
});

export { pool };
export default db;
