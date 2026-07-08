// Unit tests for the auth middleware (requireAuth, requireSessionAuth).
// Driven via a real express app on an ephemeral port so we exercise the full
// middleware stack without a database — tokenService is mocked so PAT lookups
// never touch Prisma.

import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { StringValue } from 'ms';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Set env before module import so the module-level SESSION_MAX_LIFETIME_MS
// and JWT_SECRET constants are evaluated with the test values.
const JWT_SECRET = 'auth-middleware-test-secret';
process.env.JWT_SECRET = JWT_SECRET;
process.env.SESSION_MAX_LIFETIME_MS = String(8 * 60 * 60 * 1000); // 8 hours

vi.mock('../services/tokenService', () => ({
  tokenService: { validate: vi.fn().mockResolvedValue(null) },
}));

import { requireAuth, requireSessionAuth } from './auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sign(payload: object, expiresIn: StringValue | number = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function loginAtNow() {
  return Math.floor(Date.now() / 1000);
}

function loginAtHoursAgo(hours: number) {
  return Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
});

async function startApp(): Promise<string> {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: req.user!.userId });
  });
  app.get('/session-only', requireSessionAuth, (req, res) => {
    res.json({ ok: true });
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function get(url: string, token?: string) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { status: res.status, json };
}

// ─── requireAuth — JWT path ───────────────────────────────────────────────────

describe('requireAuth — valid token', () => {
  it('accepts a JWT with a current loginAt and attaches req.user', async () => {
    const base = await startApp();
    const token = sign({ userId: 'u1', email: 'a@b.com', loginAt: loginAtNow() });
    const { status, json } = await get(`${base}/protected`, token);
    expect(status).toBe(200);
    expect(json.userId).toBe('u1');
  });

  it('accepts a JWT within the session lifetime (1 hour old)', async () => {
    const base = await startApp();
    const token = sign({ userId: 'u1', email: 'a@b.com', loginAt: loginAtHoursAgo(1) });
    const { status } = await get(`${base}/protected`, token);
    expect(status).toBe(200);
  });

  it('accepts a JWT without loginAt — backward compatibility with pre-existing tokens', async () => {
    const base = await startApp();
    const token = sign({ userId: 'u1', email: 'a@b.com' });
    const { status, json } = await get(`${base}/protected`, token);
    expect(status).toBe(200);
    expect(json.userId).toBe('u1');
  });
});

describe('requireAuth — rejected tokens', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const base = await startApp();
    const { status } = await get(`${base}/protected`);
    expect(status).toBe(401);
  });

  it('returns 401 for a malformed token string', async () => {
    const base = await startApp();
    const { status } = await get(`${base}/protected`, 'not.a.jwt');
    expect(status).toBe(401);
  });

  it('returns 401 for a JWT signed with the wrong secret', async () => {
    const base = await startApp();
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com' }, 'wrong-secret', {
      expiresIn: '1h',
    });
    const { status } = await get(`${base}/protected`, token);
    expect(status).toBe(401);
  });

  it('returns 401 for an expired JWT', async () => {
    const base = await startApp();
    const token = sign({ userId: 'u1', email: 'a@b.com', loginAt: loginAtNow() }, '-1s');
    const { status } = await get(`${base}/protected`, token);
    expect(status).toBe(401);
  });

  it('returns 401 when the absolute session lifetime is exceeded (loginAt 9h ago)', async () => {
    const base = await startApp();
    // 9 hours ago exceeds the 8-hour SESSION_MAX_LIFETIME_MS set above
    const token = sign({
      userId: 'u1',
      email: 'a@b.com',
      loginAt: loginAtHoursAgo(9),
    });
    const { status } = await get(`${base}/protected`, token);
    expect(status).toBe(401);
  });
});

// ─── requireSessionAuth ───────────────────────────────────────────────────────

describe('requireSessionAuth', () => {
  it('accepts a valid session JWT', async () => {
    const base = await startApp();
    const token = sign({ userId: 'u1', email: 'a@b.com', loginAt: loginAtNow() });
    const { status } = await get(`${base}/session-only`, token);
    expect(status).toBe(200);
  });

  it('rejects a PAT (mtl_ prefix) with a descriptive error', async () => {
    const base = await startApp();
    const { status, json } = await get(`${base}/session-only`, 'mtl_some_personal_access_token');
    expect(status).toBe(401);
    expect(String(json.error)).toMatch(/session authentication/i);
  });

  it('rejects a JWT whose absolute session lifetime is exceeded', async () => {
    const base = await startApp();
    const token = sign({
      userId: 'u1',
      email: 'a@b.com',
      loginAt: loginAtHoursAgo(9),
    });
    const { status } = await get(`${base}/session-only`, token);
    expect(status).toBe(401);
  });

  it('rejects when Authorization header is missing', async () => {
    const base = await startApp();
    const { status } = await get(`${base}/session-only`);
    expect(status).toBe(401);
  });
});
