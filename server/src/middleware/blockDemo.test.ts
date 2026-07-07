// Unit tests for the blockDemo middleware.

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { blockDemo } from './blockDemo';

function makeApp(isDemo: boolean | undefined) {
  const app = express();
  app.use((req, _res, next) => {
    (req as express.Request & { user: { userId: string; email: string; isPaid: boolean; isDemo?: boolean } }).user = {
      userId: 'user-1',
      email: 'test@example.com',
      isPaid: false,
      isDemo,
    };
    next();
  });
  app.post('/guarded', blockDemo, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('blockDemo', () => {
  it('blocks a demo user with a 403 and a friendly message', async () => {
    const res = await request(makeApp(true)).post('/guarded');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "This isn't available in demo mode. Create a free account to unlock it." });
  });

  it('allows a real (non-demo) user through', async () => {
    const res = await request(makeApp(false)).post('/guarded');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('allows a user through when isDemo is absent from the JWT claim entirely', async () => {
    const res = await request(makeApp(undefined)).post('/guarded');
    expect(res.status).toBe(200);
  });
});
