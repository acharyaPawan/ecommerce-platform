import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { serve } from '@hono/node-server'

import dotenv from "dotenv";
import app from "./src/app";
import { logger } from "./src/logger";

dotenv.config({ path: ".env.test" });

// const POSTGRES_USER = 'test'
// const POSTGRES_PASSWORD = 'test'
// const POSTGRES_DB = 'test'

// // Make sure to use Postgres 15 with pg_uuidv7 installed
// // Ensure you have the pg_uuidv7 docker image locally
// // You may need to modify pg_uuid's dockerfile to install the extension or build a new image from its base
// // https://github.com/fboulnois/pg_uuidv7
// const container = await new PostgreSqlContainer('18.1-alpine3.23')
//     .withEnvironment({
//         POSTGRES_USER: POSTGRES_USER,
//         POSTGRES_PASSWORD: POSTGRES_PASSWORD,
//         POSTGRES_DB: POSTGRES_DB,
//     })
//     .withExposedPorts(5432)
//     .start()

// const server = serve({
//   fetch: app.fetch,
//   port: Number(process.env.PORT) ?? 3001,
// });
logger.info(`[iam-svc] listening on port ${process.env.PORT ?? 3001}`);
    
//spin up db
