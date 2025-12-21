import { Hono } from "hono";
import { auth } from "./auth";

export const app = new Hono()
.get('/', (c) => c.json({ service: SERVICE_NAME, status: 'ok' }))
.get('/healthz', (c) => c.json({ status: 'healthy' }))
.get('/readyz', (c) => c.json({ status: 'ready' }))
.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

const SERVICE_NAME = 'iam-svc';
