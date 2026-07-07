import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { authRateLimit } from '../middleware/rateLimit';

const servers: Server[] = [];

afterAll(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) => new Promise<void>((resolve) => s.close(() => resolve()))
    )
  );
});

function listen(app: express.Express): Promise<string> {
  return new Promise((resolve) => {
    const s = app.listen(0, () => {
      const { port } = s.address() as AddressInfo;
      servers.push(s);
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function fetchStatus(url: string, body: unknown): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await res.text();
  return res.status;
}

interface HeadersMap {
  [key: string]: string;
}

async function fetchWithHeaders(
  base: string,
  body: unknown
): Promise<{ status: number; headers: HeadersMap }> {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await res.text();
  const headers: HeadersMap = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return { status: res.status, headers };
}

describe('TRE-24: authRateLimit factory — header contract', () => {
  it('emits RateLimit-* headers and omits legacy X-RateLimit-* headers', async () => {
    const limiter = authRateLimit('test-header', {
      windowMs: 60_000,
      max: 5,
      message: { error: 'too many' },
    });

    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (_req, res) =>
      res.status(401).json({ error: 'bad' })
    );
    const base = await listen(app);

    // Make requests up to and past the limit.
    let last: { status: number; headers: HeadersMap } | undefined;
    for (let i = 0; i < 6; i++) {
      last = await fetchWithHeaders(base, { email: `u${i}@example.com` });
    }

    expect(last!.status).toBe(429);

    expect(last!.headers).toHaveProperty('ratelimit-limit');
    expect(last!.headers).toHaveProperty('ratelimit-remaining');
    expect(last!.headers).toHaveProperty('ratelimit-reset');
    expect(last!.headers['ratelimit-limit']).toBe('5');
    expect(last!.headers['ratelimit-remaining']).toBe('0');

    expect(last!.headers).not.toHaveProperty('x-ratelimit-limit');
    expect(last!.headers).not.toHaveProperty('x-ratelimit-remaining');
    expect(last!.headers).not.toHaveProperty('x-ratelimit-reset');
  });

  it('headers appear even on successful (non-429) requests', async () => {
    const limiter = authRateLimit('test-fresh', {
      windowMs: 60_000,
      max: 10,
      message: { error: 'too many' },
    });

    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (_req, res) =>
      res.status(401).json({ error: 'bad' })
    );
    const base = await listen(app);

    const { status, headers } = await fetchWithHeaders(base, { email: 'a@example.com' });
    expect(status).toBe(401);
    expect(headers).toHaveProperty('ratelimit-limit');
    expect(headers).toHaveProperty('ratelimit-remaining');
    expect(headers['ratelimit-limit']).toBe('10');
    expect(Number(headers['ratelimit-remaining'])).toBe(9);
    expect(headers).not.toHaveProperty('x-ratelimit-limit');
  });
});

describe('TRE-24: option passthrough and defaults', () => {
  it('passes through all provided options to express-rate-limit', async () => {
    const limiter = authRateLimit('test-passthrough', {
      windowMs: 30_000,
      max: 3,
      message: { error: 'custom error message' },
      skipSuccessfulRequests: true,
    });

    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (req, res) => {
      if (req.body?.password === 'correct') return res.json({ ok: true });
      return res.status(401).json({ error: 'bad' });
    });
    const base = await listen(app);

    // Successful logins don't count.
    for (let i = 0; i < 10; i++) {
      expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'correct' })).toBe(200);
    }

    // Failed logins count, hitting max=3.
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(401);
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(401);

    // Different email still fails because it's per-IP, not per-account with this
    // vanilla limiter (no custom keyGenerator). 3 failed = throttle.
    expect(await fetchStatus(`${base}/login`, { email: 'b@example.com', password: 'wrong' })).toBe(401);
    expect(await fetchStatus(`${base}/login`, { email: 'c@example.com', password: 'wrong' })).toBe(429);
  });

  it('applies standardHeaders: true and legacyHeaders: false as defaults', async () => {
    // The factory always applies these — verify by creating a limiter with no
    // explicit header options. The first response should have RateLimit-* headers.
    const limiter = authRateLimit('test-defaults', {
      windowMs: 60_000,
      max: 100,
      message: { error: 'too many' },
    });

    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (_req, res) => res.status(200).json({ ok: true }));
    const base = await listen(app);

    const { headers } = await fetchWithHeaders(base, { email: 'a@example.com' });
    expect(headers).toHaveProperty('ratelimit-limit');
    expect(headers).not.toHaveProperty('x-ratelimit-limit');
  });
});

describe('TRE-24: distinct prefix isolation per limiter name', () => {
  it('two limiters with different names have independent counters', async () => {
    const limiterA = authRateLimit('service-a', {
      windowMs: 60_000,
      max: 3,
      message: { error: 'too many' },
    });
    const limiterB = authRateLimit('service-b', {
      windowMs: 60_000,
      max: 3,
      message: { error: 'too many' },
    });

    const app = express();
    app.use(express.json());
    app.post('/a', limiterA, (_req, res) => res.status(401).json({ error: 'bad' }));
    app.post('/b', limiterB, (_req, res) => res.status(401).json({ error: 'bad' }));
    const base = await listen(app);

    // Exhaust limiter A.
    for (let i = 0; i < 3; i++) {
      expect(await fetchStatus(`${base}/a`, { email: `u${i}@example.com` })).toBe(401);
    }
    expect(await fetchStatus(`${base}/a`, { email: 'last@example.com' })).toBe(429);

    // Limiter B has its own counter.
    expect(await fetchStatus(`${base}/b`, { email: 'fresh@example.com' })).toBe(401);
  });
});

describe('TRE-24: memory store — fresh limiter starts clean', () => {
  it('a new limiter instance has a fresh counter (simulates process restart)', async () => {
    const opts = {
      windowMs: 60_000,
      max: 3,
      message: { error: 'too many' },
    };

    // First limiter — exhaust it.
    const limiter1 = authRateLimit('test-restart', opts);
    const app1 = express();
    app1.use(express.json());
    app1.post('/login', limiter1, (_req, res) => res.status(401).json({ error: 'bad' }));
    const base1 = await listen(app1);

    for (let i = 0; i < 3; i++) {
      await fetchStatus(`${base1}/login`, { email: `u${i}@example.com` });
    }
    expect(await fetchStatus(`${base1}/login`, { email: 'last@example.com' })).toBe(429);

    await new Promise<void>((resolve) => servers.pop()!.close(() => resolve()));

    // Second limiter — should start clean (same as a process restart).
    const limiter2 = authRateLimit('test-restart', opts);
    const app2 = express();
    app2.use(express.json());
    app2.post('/login', limiter2, (_req, res) => res.status(401).json({ error: 'bad' }));
    const base2 = await listen(app2);

    expect(await fetchStatus(`${base2}/login`, { email: 'fresh@example.com' })).toBe(401);
  });
});

describe('TRE-24: edge cases — skipSuccessfulRequests', () => {
  it('successful requests do not consume the rate-limit budget', async () => {
    const limiter = authRateLimit('test-skip-success', {
      windowMs: 60_000,
      max: 3,
      message: { error: 'too many' },
      skipSuccessfulRequests: true,
    });

    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (req, res) => {
      if (req.body?.password === 'correct') return res.json({ ok: true });
      return res.status(401).json({ error: 'bad' });
    });
    const base = await listen(app);

    // Many successful requests — none count toward the limit.
    for (let i = 0; i < 20; i++) {
      expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'correct' })).toBe(200);
    }

    // First failure counts.
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(401);
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(401);
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(401);
    // 4th failure → throttled.
    expect(await fetchStatus(`${base}/login`, { email: 'a@example.com', password: 'wrong' })).toBe(429);
  });
});

describe('TRE-24: existing authRateLimit limiters use the factory', () => {
  it('registerLimiter (singleton) RateLimit-* headers', async () => {
    const { registerLimiter } = await import('../middleware/authRateLimit');
    const app = express();
    app.use(express.json());
    app.post('/login', registerLimiter, (_req, res) =>
      res.status(401).json({ error: 'bad' })
    );
    const base = await listen(app);

    const { status, headers } = await fetchWithHeaders(base, { email: 'a@example.com' });
    expect(status).toBe(401);
    expect(headers).toHaveProperty('ratelimit-limit');
    expect(headers).not.toHaveProperty('x-ratelimit-limit');
  });
});
