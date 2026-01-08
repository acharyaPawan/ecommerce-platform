import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FromSchema } from "json-schema-to-ts";
import type { AppType } from '../../src/app'
import type { Pool } from 'pg';
import { ServerType } from '@hono/node-server';
import { iamOutboxEvents } from '../../src/db/schema';
import { IamEventType, makeIamEnvelope } from '../../src/contracts/iam-events';
import { mapToOutboxEvent } from '../../src/auth';
import { applyMigrations, setupDockerTestDb, setupServer } from './test-utils';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { logger } from '../../src/logger';

describe("Better-auth hooks works", () => {
    let container: StartedPostgreSqlContainer
    let server: ServerType
    let app: AppType
    let db: typeof import('../../src/db').default
    let pool: Pool

    beforeAll(async () => {
        const docker = await setupDockerTestDb();
        container = docker.container;
        process.env.DATABASE_URL = docker.connectionString;

        vi.resetModules();
        const dbModule = await import('../../src/db');
        db = dbModule.default;
        pool = dbModule.pool;
        await applyMigrations(db);
        ({ default: app } = await import('../../src/app'));

        server = await setupServer(app, 3002);
    }, 60000 )

    afterAll(async () => {
        await server.close();
        await pool.end();
        await container.stop();
    })

    it("stores", async () => {
        const body = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'password',
            image: '',
            callbackURL: '',
            rememberMe: true
        }
        const resSchema = {
            "type": "object",
            "properties": {
                "token": {
                    "type": "string",
                    "nullable": true,
                    "description": "Authentication token for the session"
                },
                "user": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "The unique identifier of the user"
                        },
                        "email": {
                            "type": "string",
                            "format": "email",
                            "description": "The email address of the user"
                        },
                        "name": {
                            "type": "string",
                            "description": "The name of the user"
                        },
                        "image": {
                            "type": "string",
                            "format": "uri",
                            "nullable": true,
                            "description": "The profile image URL of the user"
                        },
                        "emailVerified": {
                            "type": "boolean",
                            "description": "Whether the email has been verified"
                        },
                        "createdAt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the user was created"
                        },
                        "updatedAt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the user was last updated"
                        }
                    },
                    "required": [
                        "id",
                        "email",
                        "name",
                        "emailVerified",
                        "createdAt",
                        "updatedAt"
                    ]
                }
            },
            "required": [
                "user"
            ]
        } as const;
        type resType = FromSchema<typeof resSchema>
        logger.info('Sending request to http://localhost:3002/api/auth/sign-up/email');
        const res = await fetch('http://localhost:3002/api/auth/sign-up/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        expect(res.status).toBe(200);
        const json: resType = await res.json();
        expect(json.user.name).toBe(body.name);
        logger.info("Returns:");
        logger.info({ response: json }, "auth response");

        const envelope = makeIamEnvelope({
                  type: IamEventType.UserRegisteredV1,
                  aggregateId: json.user.id,
                  payload: {
                    userId: json.user.id,
                    email: json.user.email,
                    name: json.user.name ?? null,
                    emailVerified: Boolean(json.user.emailVerified),
                  },
                });
        
        const {id, occurredAt, ...dbEntry} = mapToOutboxEvent(envelope)
        

        //is event stored
        logger.info("Querying to db,to check");
        const result = await db.query.iamOutboxEvents.findMany({
            limit: 5,
            orderBy: (iamOutboxEvents, {desc}) => [desc(iamOutboxEvents.createdAt)],
        	// we donot need error, for single test case
        })
        logger.info({ result }, "Got:");
        expect(result[0]).toMatchObject(dbEntry)
    });
});
