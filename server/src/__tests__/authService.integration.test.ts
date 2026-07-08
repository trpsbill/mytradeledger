// Integration tests for the auth service (registration, login, session
// refresh). These run against a real ephemeral PostgreSQL container
// (provisioned by integration-setup.ts) so the Prisma write paths and bcrypt
// round-trips are exercised end-to-end.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// signToken needs a secret; set before authService (→ jwt) is exercised.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Use the module default (5 min) — we verify exp is well under 30 days.
// SESSION_MAX_LIFETIME_MS left unset so the 8h default applies for the
// refreshSession "exceeded" test.

import jwt from 'jsonwebtoken';
import prisma from '../db';
import { authService } from '../services/authService';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // FK-safe truncate
  await prisma.personalAccessToken.deleteMany();
  await prisma.ledgerMetadata.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── register ─────────────────────────────────────────────────────────────────

describe('authService.register', () => {
  it('creates a user with a bcrypt-hashed password (never plaintext) and a valid JWT', async () => {
    const { user, token } = await authService.register('Trader@Example.com', 'hunter2pw');

    // Email is normalised to lowercase
    expect(user.email).toBe('trader@example.com');

    // Password is hashed, not stored in the clear
    expect(user.passwordHash).not.toBe('hunter2pw');
    expect(user.passwordHash.startsWith('$2')).toBe(true); // bcrypt prefix

    // JWT carries userId, email, and the new loginAt + short-lived exp claims
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    expect(payload.userId).toBe(user.id);
    expect(payload.email).toBe('trader@example.com');
    expect(payload.loginAt).toBeTypeOf('number');
    // exp should reflect SESSION_IDLE_TIMEOUT_MS (default 5 min), not 30 days
    const ttlSeconds = payload.exp - payload.iat;
    expect(ttlSeconds).toBeLessThanOrEqual(60 * 60); // well under 1 hour
    expect(ttlSeconds).toBeGreaterThan(0);
  });

  it('rejects a duplicate email (case-insensitive) with EMAIL_IN_USE', async () => {
    await authService.register('dupe@example.com', 'password123');
    await expect(authService.register('DUPE@example.com', 'password123')).rejects.toThrow(
      'EMAIL_IN_USE'
    );
    expect(await prisma.user.count()).toBe(1);
  });
});

// ─── login ──────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(async () => {
    await authService.register('login@example.com', 'correct-horse');
  });

  it('succeeds with correct credentials and returns a JWT with loginAt', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { user, token } = await authService.login('login@example.com', 'correct-horse');
    const after = Math.floor(Date.now() / 1000);
    expect(user.email).toBe('login@example.com');
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    expect(payload.userId).toBe(user.id);
    // loginAt must be stamped at the time of login
    expect(payload.loginAt).toBeGreaterThanOrEqual(before);
    expect(payload.loginAt).toBeLessThanOrEqual(after);
  });

  it('is case-insensitive on the email', async () => {
    const { user } = await authService.login('LOGIN@EXAMPLE.COM', 'correct-horse');
    expect(user.email).toBe('login@example.com');
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    await expect(authService.login('login@example.com', 'wrong-password')).rejects.toThrow(
      'INVALID_CREDENTIALS'
    );
  });

  it('rejects an unknown email with INVALID_CREDENTIALS (no enumeration)', async () => {
    await expect(authService.login('nobody@example.com', 'whatever12')).rejects.toThrow(
      'INVALID_CREDENTIALS'
    );
  });
});

// ─── refreshSession ───────────────────────────────────────────────────────────

describe('authService.refreshSession', () => {
  beforeEach(async () => {
    await authService.register('login@example.com', 'correct-horse');
  });

  it('issues a new JWT with the same loginAt but a fresh exp', async () => {
    const { user, token: original } = await authService.login('login@example.com', 'correct-horse');
    const originalPayload = jwt.decode(original) as any;
    const loginAt = originalPayload.loginAt as number;

    // Small delay so the new exp is measurably later than the original
    await new Promise((r) => setTimeout(r, 50));

    const newToken = await authService.refreshSession(user.id, loginAt);
    const newPayload = jwt.verify(newToken, process.env.JWT_SECRET!) as any;

    // loginAt is preserved — still tracks the original login time
    expect(newPayload.loginAt).toBe(loginAt);
    // A fresh exp means the new token lives longer than the original would have
    expect(newPayload.exp).toBeGreaterThanOrEqual(originalPayload.exp);
    // Core identity claims are preserved
    expect(newPayload.userId).toBe(user.id);
    expect(newPayload.email).toBe(user.email);
  });

  it('refreshes without a loginAt (undefined) — backward compat path', async () => {
    const { user } = await authService.login('login@example.com', 'correct-horse');
    // Old tokens without loginAt pass undefined; refresh should still succeed
    const newToken = await authService.refreshSession(user.id, undefined);
    const payload = jwt.verify(newToken, process.env.JWT_SECRET!) as any;
    expect(payload.userId).toBe(user.id);
  });

  it('throws SESSION_MAX_LIFETIME_EXCEEDED when loginAt is beyond the 8h cap', async () => {
    const { user } = await authService.login('login@example.com', 'correct-horse');
    // 9 hours ago in epoch seconds exceeds the default 8h SESSION_MAX_LIFETIME_MS
    const staleLaginAt = Math.floor((Date.now() - 9 * 60 * 60 * 1000) / 1000);
    await expect(authService.refreshSession(user.id, staleLaginAt)).rejects.toThrow(
      'SESSION_MAX_LIFETIME_EXCEEDED'
    );
  });

  it('throws USER_NOT_FOUND for a nonexistent user id', async () => {
    await expect(
      authService.refreshSession('00000000-0000-0000-0000-000000000000', Math.floor(Date.now() / 1000))
    ).rejects.toThrow('USER_NOT_FOUND');
  });
});
