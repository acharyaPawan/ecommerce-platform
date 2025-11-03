import { Hono } from 'hono';
import { registerRoutes } from './api';

export async function createApp() {
  const app = new Hono();
  registerRoutes(app);
  return app;
}
