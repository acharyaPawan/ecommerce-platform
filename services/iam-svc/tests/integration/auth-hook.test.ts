import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { AppType } from '../../src/app'
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import { FromSchema } from "json-schema-to-ts";
import { iamOutboxEvents } from '../../src/db/schema';
import { serve, ServerType } from '@hono/node-server';
import { pushSchema } from 'drizzle-kit/api'
import * as schema from '../../src/db/schema'
import type { Pool } from 'pg';
import { IamEventType, makeIamEnvelope } from '../../src/contracts/iam-events';
import { mapToOutboxEvent } from '../../src/auth';
import { eq } from 'drizzle-orm';

export async function setupDockerTestDb() {
    const POSTGRES_USER = 'test'
    const POSTGRES_PASSWORD = 'test'
    const POSTGRES_DB = 'test'

    // Make sure to use Postgres 15 with pg_uuidv7 installed
    // Ensure you have the pg_uuidv7 docker image locally
    // You may need to modify pg_uuid's dockerfile to install the extension or build a new image from its base
    // https://github.com/fboulnois/pg_uuidv7
    const container = await new PostgreSqlContainer("postgres:18.1-alpine").withEnvironment({
            POSTGRES_USER: POSTGRES_USER,
            POSTGRES_PASSWORD: POSTGRES_PASSWORD,
            POSTGRES_DB: POSTGRES_DB,
        })
        .withExposedPorts(5432)
        .start()

    // const connectionString = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${container.getHost()}:${container.getFirstMappedPort()}/${POSTGRES_DB}`
    return { container, connectionString: container.getConnectionUri() }
}


export async function setupServer(app: AppType) {
    return serve({
        fetch: app.fetch,
        port: Number(process.env.PORT) ?? 3001
    })
}

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
        await (await pushSchema(schema, db as any)).apply();
        ({ default: app } = await import('../../src/app'));

        server = await setupServer(app);
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
        console.log('Sending request to http://localhost:3001/api/auth/sign-up/email')
        const res = await fetch('http://localhost:3001/api/auth/sign-up/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        expect(res.status).toBe(200);
        const json: resType = await res.json();
        expect(json.user.name).toBe(body.name);
        console.log('Returns: ');
        console.log(JSON.stringify(json, null, 3));

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
        console.log('Querying to db,to check')
        const result = await db.query.iamOutboxEvents.findMany({
            limit: 5,
            orderBy: (iamOutboxEvents, {desc}) => [desc(iamOutboxEvents.createdAt)],
        	// we donot need error, for single test case

        })
        console.log('Got: ', JSON.stringify(result, null, 3));
        expect(result[0]).toMatchObject(dbEntry)
    });
});
