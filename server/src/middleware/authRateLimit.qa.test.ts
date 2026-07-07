// QA edge-case coverage for the per-account login lockout (#6, TRE-28).
//
// The developer's authRateLimit.test.ts covers the happy paths (lock after max,
// per-account isolation, skipSuccessfulRequests, email normalisation). These
// tests close the security-sensitive gaps the QA ticket called out explicitly:
//   - the IP-fallback bucket for email-less / malformed request bodies, and
//   - the per-IP limiter as a distinct first layer that throttles independently
//     of the email.
// Same throwaway-Express-on-an-ephemeral-port approach as the dev tests — no DB.

import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { Request } from 'express';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { loginAccountKey, makeAccountLoginLimiter, loginIpLimiter } from './authRateLimit';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
});

async function listen(app: express.Express): Promise<string> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function post(base: string, body: unknown) {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await res.text();
  return res.status;
}

describe('loginAccountKey (bucket derivation)', () => {
  const key = (body: unknown, ip = '203.0.113.7') =>
    loginAccountKey({ body, ip } as unknown as Request);

  it('buckets a present email under acct:<normalised email>', () => {
    expect(key({ email: 'User@Example.com' })).toBe('acct:user@example.com');
    expect(key({ email: '  user@example.com  ' })).toBe('acct:user@example.com');
  });

  it('falls back to ip:<addr> when email is missing, empty, or not a string', () => {
    expect(key({})).toBe('ip:203.0.113.7');
    expect(key({ email: '' })).toBe('ip:203.0.113.7');
    expect(key({ email: '   ' })).toBe('ip:203.0.113.7');
    expect(key({ email: 12345 })).toBe('ip:203.0.113.7');
    expect(key({ email: null })).toBe('ip:203.0.113.7');
    expect(key(undefined)).toBe('ip:203.0.113.7');
  });

  it('does not collapse all email-less requests into one global bucket — keys by IP', () => {
    expect(key({}, '198.51.100.1')).toBe('ip:198.51.100.1');
    expect(key({}, '198.51.100.2')).toBe('ip:198.51.100.2');
  });
});

describe('per-account limiter — IP fallback for malformed bodies', () => {
  it('still throttles email-less requests (shared IP bucket), not a free pass', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', makeAccountLoginLimiter({ max: 3 }), (_req, res) =>
      res.status(401).json({ error: 'bad' })
    );
    const base = await listen(app);

    // No email in the body → all land in the same ip: bucket from one source.
    expect(await post(base, { password: 'wrong' })).toBe(401);
    expect(await post(base, { password: 'wrong' })).toBe(401);
    expect(await post(base, { password: 'wrong' })).toBe(401);
    // 4th malformed attempt is throttled — the fallback bucket is enforced.
    expect(await post(base, { password: 'wrong' })).toBe(429);
  });

  it('email-less traffic does not consume a real account bucket', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', makeAccountLoginLimiter({ max: 3 }), (req, res) =>
      res.status(req.body?.password === 'correct' ? 200 : 401).json({})
    );
    const base = await listen(app);

    // Exhaust the IP-fallback bucket with malformed bodies.
    for (let i = 0; i < 4; i++) await post(base, { password: 'wrong' });
    expect(await post(base, { password: 'wrong' })).toBe(429);

    // A genuine account from the same source still has its own fresh bucket.
    expect(await post(base, { email: 'real@example.com', password: 'correct' })).toBe(200);
  });
});

describe('per-IP login limiter — first layer, email-independent', () => {
  it('throttles by source IP regardless of which email is used', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', loginIpLimiter, (_req, res) => res.status(401).json({ error: 'bad' }));
    const base = await listen(app);

    // loginIpLimiter max is 10; vary the email every attempt so this can only be
    // an IP-keyed lock, not an account one.
    for (let i = 0; i < 10; i++) {
      expect(await post(base, { email: `u${i}@example.com`, password: 'wrong' })).toBe(401);
    }
    // 11th attempt — different email again — is throttled purely on the IP.
    expect(await post(base, { email: 'u99@example.com', password: 'wrong' })).toBe(429);
  });
});
