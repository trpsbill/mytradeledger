// Unit tests for the per-account login lockout (#6). These exercise the limiter
// middleware directly against a throwaway Express app on an ephemeral port — no
// database or auth service involved, so they run in the fast `npm test` suite.
//
// The fake `/login` handler stands in for the real controller: it replies 200
// when the password is "correct" and 401 otherwise, which is all the limiter
// keys off (it counts only non-2xx responses thanks to skipSuccessfulRequests).

import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { makeAccountLoginLimiter } from './authRateLimit';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) => new Promise<void>((resolve) => s.close(() => resolve()))
    )
  );
});

// Spin up an app whose /login is guarded by a per-account limiter with the given
// `max`, and return its base URL.
async function startApp(max: number): Promise<string> {
  const app = express();
  app.use(express.json());
  const limiter = makeAccountLoginLimiter({ max });
  app.post('/login', limiter, (req, res) => {
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

async function login(base: string, email: string, password: string) {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await res.text(); // drain so the response fully finishes before the next call
  return res.status;
}

describe('per-account login limiter', () => {
  it('locks an account after `max` failed attempts', async () => {
    const base = await startApp(3);
    const email = 'victim@example.com';

    expect(await login(base, email, 'wrong')).toBe(401);
    expect(await login(base, email, 'wrong')).toBe(401);
    expect(await login(base, email, 'wrong')).toBe(401);
    // 4th attempt is over the limit → throttled, regardless of credentials.
    expect(await login(base, email, 'wrong')).toBe(429);
    // The lock holds even if the attacker now guesses the right password.
    expect(await login(base, email, 'correct')).toBe(429);
  });

  it('keys the lock per account — other accounts are unaffected', async () => {
    const base = await startApp(3);

    // Burn through the limit for account A.
    for (let i = 0; i < 4; i++) await login(base, 'a@example.com', 'wrong');
    expect(await login(base, 'a@example.com', 'wrong')).toBe(429);

    // Account B has its own fresh bucket.
    expect(await login(base, 'b@example.com', 'wrong')).toBe(401);
    expect(await login(base, 'b@example.com', 'correct')).toBe(200);
  });

  it('does not count successful logins toward the lock', async () => {
    const base = await startApp(3);
    const email = 'busy@example.com';

    // Many successful logins must never trip the failure-based lock.
    for (let i = 0; i < 10; i++) {
      expect(await login(base, email, 'correct')).toBe(200);
    }

    // A failure mixed in still leaves the account usable — successes did not
    // consume the failure budget.
    expect(await login(base, email, 'wrong')).toBe(401);
    expect(await login(base, email, 'correct')).toBe(200);
  });

  it('normalises email casing and whitespace into one bucket', async () => {
    const base = await startApp(3);

    expect(await login(base, 'User@Example.com', 'wrong')).toBe(401);
    expect(await login(base, '  user@example.com  ', 'wrong')).toBe(401);
    expect(await login(base, 'USER@EXAMPLE.COM', 'wrong')).toBe(401);
    // Same account viewed three ways → 4th attempt is locked.
    expect(await login(base, 'user@example.com', 'wrong')).toBe(429);
  });
});
