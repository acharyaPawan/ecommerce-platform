import { Hono } from "hono";
import { ilike, or, sql } from "drizzle-orm";
import { auth } from "./auth";
import db from "./db/index.js";
import { user } from "./db/schema.js";
import { logger } from "./logger";

const TEST_USER_EMAIL_REGEX = '^test[0-9]*@example\\.org$';

export const app = new Hono()
.get('/', (c) => c.json({ service: SERVICE_NAME, status: 'ok' }))
.get('/healthz', (c) => { logger.debug("In healthz route");return c.json({ status: 'healthy' })})
.get('/readyz', (c) => c.json({ status: 'ready' }))
.delete('/testing/test-users', async (c) => {
  const deletedUsers = await db
    .delete(user)
    .where(
      or(
        ilike(user.name, "test%"),
        sql`(${user.email}) ~ ${TEST_USER_EMAIL_REGEX}`
      )
    )
    .returning({ id: user.id });

  return c.json({
    deletedCount: deletedUsers.length,
    deletedUserIds: deletedUsers.map((entry) => entry.id),
  });
})
.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

export type AppType = typeof app
export default app

const SERVICE_NAME = 'iam-svc';
