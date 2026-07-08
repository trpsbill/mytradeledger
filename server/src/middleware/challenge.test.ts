// Unit tests for the failure-triggered anti-automation challenge (#6). Like the
// rate-limiter tests these run against a throwaway Express app on an ephemeral
// port, no DB. They drive the middleware with enabled:true (production defaults
// to disabled until a provider is chosen).

import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { challengeAfterFailures, stubChallengeProvider } from './challenge';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
});

async function startApp(threshold: number): Promise<string> {
  const app = express();
  app.use(express.json());
  const challenge = challengeAfterFailures({
    enabled: true,
    threshold,
    provider: stubChallengeProvider,
  });
  app.post('/login', challenge, (req, res) => {
    if (req.body?.password === 'correct') return res.json({ ok: true });
    return res.status(401).json({ error: 'bad' });
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function post(base: string, body: Record<string, unknown>, challengeToken?: string) {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(challengeToken ? { 'x-challenge-token': challengeToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

describe('challengeAfterFailures', () => {
  it('is a no-op when disabled (default)', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', challengeAfterFailures({ enabled: false, threshold: 1 }), (_req, res) =>
      res.status(401).json({ error: 'bad' })
    );
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    // Far past any threshold, yet never demands a challenge.
    for (let i = 0; i < 5; i++) {
      const { status } = await post(base, { email: 'x@example.com', password: 'wrong' });
      expect(status).toBe(401);
    }
  });

  it('demands a challenge after the failure threshold, then accepts a valid token', async () => {
    const base = await startApp(2);
    const email = 'target@example.com';

    expect((await post(base, { email, password: 'wrong' })).status).toBe(401);
    expect((await post(base, { email, password: 'wrong' })).status).toBe(401);

    // Threshold reached → next attempt without a token is blocked with 403.
    const blocked = await post(base, { email, password: 'wrong' });
    expect(blocked.status).toBe(403);
    expect(blocked.json.challengeRequired).toBe(true);

    // Supplying a valid challenge token lets the request through to the handler
    // (which still rejects the wrong password with 401 — the challenge gates
    // access, it doesn't authenticate).
    const solved = await post(base, { email, password: 'wrong' }, 'solved');
    expect(solved.status).toBe(401);
  });

  it('clears the challenge requirement after a successful login', async () => {
    const base = await startApp(2);
    const email = 'recover@example.com';

    await post(base, { email, password: 'wrong' });
    await post(base, { email, password: 'wrong' });
    // Blocked now…
    expect((await post(base, { email, password: 'wrong' })).status).toBe(403);

    // …solve the challenge and log in correctly, which resets the counter…
    expect((await post(base, { email, password: 'correct' }, 'solved')).status).toBe(200);

    // …so the next failed attempt is back to a plain 401, no challenge demanded.
    expect((await post(base, { email, password: 'wrong' })).status).toBe(401);
  });
});
