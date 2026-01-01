import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('gateway app', () => {
  it('returns ok from root endpoint', async () => {
    const app = await createApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const payload = await res.json<{ service: string; status: string }>();
    expect(payload.service).toBe('gateway');
    expect(payload.status).toBe('ok');
  });

  it('exposes healthz endpoint', async () => {
    const app = await createApp();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
  });
});
