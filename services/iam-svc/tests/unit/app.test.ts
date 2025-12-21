import { describe, expect, it, vi } from 'vitest';
import { testClient } from 'hono/testing'
import {app} from '../../src/app'


// vi.mock('../../src/auth', () => ({
//   auth: {
//     handler: vi.fn(() => new Response(null, { status: 204 })),
//   },
// }));

describe('iam-svc client', () => {
  it('returns ok from root endpoint', async () => {
    const client = testClient(app)
    const res = await client.index.$get();
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.service).toBe('iam-svc');
    expect(payload.status).toBe('ok');
  });

  it('exposes healthz endpoint', async () => {
    const client = testClient(app);
    const res = await client.healthz.$get();
    expect(res.status).toBe(200);
  });
});
