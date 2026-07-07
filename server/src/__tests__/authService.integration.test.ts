// Integration tests for the auth service (registration, login, email
// verification, password reset). These run against a real ephemeral PostgreSQL
// container (provisioned by integration-setup.ts) so the Prisma write paths,
// token hashing, and bcrypt round-trips are exercised end-to-end.
//
// The email module is mocked: its real implementation talks to Mailjet, and the
// raw verification/reset tokens are only ever delivered via email (the DB stores
// SHA-256 hashes). Capturing the raw token from the mock is the only way to then
// drive verifyEmail()/resetPassword() the way a real user would.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the raw tokens handed to the email layer.
const sentVerificationTokens: Array<{ email: string; token: string }> = [];
const sentResetTokens: Array<{ email: string; token: string }> = [];

vi.mock('../services/email', () => ({
  sendVerificationEmail: vi.fn(async (user: { email: string }, rawToken: string) => {
    sentVerificationTokens.push({ email: user.email, token: rawToken });
  }),
  sendPasswordResetEmail: vi.fn(async (user: { email: string }, rawToken: string) => {
    sentResetTokens.push({ email: user.email, token: rawToken });
  }),
}));

// signToken needs a secret; set before authService (→ jwt) is exercised.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Use the module default (5 min) — we verify exp is well under 30 days.
// SESSION_MAX_LIFETIME_MS left unset so the 8h default applies for the
// refreshSession "exceeded" test.


import jwt from 'jsonwebtoken';
import prisma from '../db';
import { authService } from '../services/authService';
import { authEmailGuard } from '../services/emailSendGuard';

// Runs `fn` with emailVerificationToken.create forced to reject, simulating the
// #17 failure where the verification-token DB write blows up after the user row
// is committed. The original method is restored manually rather than via
// spy.mockRestore(): Prisma model methods are Proxy-trapped, and mockRestore()
// leaves `create` as `undefined` (not a function), which would silently break
// every later test that issues a token.
async function withFailingTokenCreate<T>(fn: () => Promise<T>): Promise<T> {
  const original = prisma.emailVerificationToken.create;
  (prisma.emailVerificationToken as { create: unknown }).create = vi
    .fn()
    .mockRejectedValue(new Error('simulated token DB write failure'));
  try {
    return await fn();
  } finally {
    (prisma.emailVerificationToken as { create: unknown }).create = original;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  sentVerificationTokens.length = 0;
  sentResetTokens.length = 0;

  // The auth-email guard is a process-wide singleton; clear its in-memory
  // counters so per-email/global limits don't bleed across tests.
  authEmailGuard.reset();

  // FK-safe truncate
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
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
    const { user, token } = await authService.register('Trader@Example.com', 'hunter2pw', true);

    // Email is normalised to lowercase
    expect(user.email).toBe('trader@example.com');
    expect(user.marketingOptIn).toBe(true);

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

  it('new accounts start unverified and trigger exactly one verification email', async () => {
    const { user } = await authService.register('verify@me.com', 'password123', false);

    expect(user.emailVerifiedAt).toBeNull();
    expect(sentVerificationTokens).toHaveLength(1);
    expect(sentVerificationTokens[0].email).toBe('verify@me.com');

    // A single unused verification token persisted, stored as a hash (not the raw token)
    const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(sentVerificationTokens[0].token);
    expect(tokens[0].usedAt).toBeNull();
  });

  it('rejects a duplicate email (case-insensitive) with EMAIL_IN_USE', async () => {
    await authService.register('dupe@example.com', 'password123', false);
    await expect(authService.register('DUPE@example.com', 'password123', false)).rejects.toThrow(
      'EMAIL_IN_USE'
    );
    expect(await prisma.user.count()).toBe(1);
  });

  // Regression for #17: the user row is committed before the verification token
  // is issued. If the token DB write throws, registration must still succeed
  // (201 with user + JWT) rather than 500 — otherwise the client can't tell the
  // account was created and a retry hits the "email already in use" path. The
  // failure is logged and the missing email is recoverable via resend.
  it('returns the user + token even when verification token issuance throws (#17)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { user, token } = await withFailingTokenCreate(() =>
      authService.register('resilient@example.com', 'password123', false)
    );

    try {
      // Registration succeeded despite the token failure.
      expect(user.email).toBe('resilient@example.com');
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(payload.userId).toBe(user.id);

      // The user row was actually committed (recoverable via resend).
      const persisted = await prisma.user.findUnique({ where: { id: user.id } });
      expect(persisted).not.toBeNull();

      // No verification token persisted (the create threw), and the failure was logged.
      const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  // A committed user from a failed token-issuance must be able to recover by
  // resending the verification email — the whole point of making #17 non-fatal.
  it('a registration with failed token issuance is recoverable via resendVerification (#17)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { user } = await withFailingTokenCreate(() =>
      authService.register('recover@example.com', 'password123', false)
    );
    errorSpy.mockRestore();

    expect(sentVerificationTokens).toHaveLength(0);

    // Resend now works normally — token persists and the email goes out.
    await authService.resendVerification('recover@example.com');
    expect(sentVerificationTokens).toHaveLength(1);
    const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);

    // And that token actually verifies the address.
    await expect(authService.verifyEmail(sentVerificationTokens[0].token)).resolves.toBeUndefined();
  });
});

// ─── login ──────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(async () => {
    await authService.register('login@example.com', 'correct-horse', false);
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

// ─── verifyEmail ──────────────────────────────────────────────────────────────

describe('authService.verifyEmail', () => {
  it('verifies the address with a valid token and consumes the token', async () => {
    const { user } = await authService.register('confirm@example.com', 'password123', false);
    const rawToken = sentVerificationTokens[0].token;

    await authService.verifyEmail(rawToken);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.emailVerifiedAt).not.toBeNull();

    const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(tokenRow.usedAt).not.toBeNull();
  });

  it('is idempotent — a double click on the link still resolves to success', async () => {
    await authService.register('confirm2@example.com', 'password123', false);
    const rawToken = sentVerificationTokens[0].token;

    await authService.verifyEmail(rawToken);
    await expect(authService.verifyEmail(rawToken)).resolves.toBeUndefined();
  });

  it('rejects an unknown token with INVALID_VERIFICATION_TOKEN', async () => {
    await expect(authService.verifyEmail('not-a-real-token')).rejects.toThrow(
      'INVALID_VERIFICATION_TOKEN'
    );
  });

  it('rejects an unused-but-expired token', async () => {
    const { user } = await authService.register('expired@example.com', 'password123', false);
    // Force the token to be in the past
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(authService.verifyEmail(sentVerificationTokens[0].token)).rejects.toThrow(
      'INVALID_VERIFICATION_TOKEN'
    );
  });

  // Regression for #16: idempotency must hold past the token's 24h lifetime.
  // usedAt is checked before expiry, so an already-verified user re-clicking an
  // old (now-expired) link still resolves to success, not an error.
  it('treats a used-AND-expired token as idempotent success (#16)', async () => {
    const { user } = await authService.register('usedexpired@example.com', 'password123', false);
    const rawToken = sentVerificationTokens[0].token;

    // First click verifies and consumes the token.
    await authService.verifyEmail(rawToken);

    // Time passes — the consumed token is now also expired.
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // Re-clicking the stale link must NOT error — the address is already verified.
    await expect(authService.verifyEmail(rawToken)).resolves.toBeUndefined();
  });
});

// ─── resendVerification ─────────────────────────────────────────────────────

describe('authService.resendVerification', () => {
  it('issues a fresh token and invalidates the prior unused one', async () => {
    const { user } = await authService.register('resend@example.com', 'password123', false);
    const firstToken = sentVerificationTokens[0].token;

    await authService.resendVerification('resend@example.com');

    // Only the latest token survives (prior unused ones are deleted)
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(sentVerificationTokens).toHaveLength(2);

    // The old token no longer verifies; the new one does
    await expect(authService.verifyEmail(firstToken)).rejects.toThrow('INVALID_VERIFICATION_TOKEN');
    await expect(authService.verifyEmail(sentVerificationTokens[1].token)).resolves.toBeUndefined();
  });

  it('silently no-ops for an unknown email (no enumeration, no send)', async () => {
    await expect(authService.resendVerification('ghost@example.com')).resolves.toBeUndefined();
    expect(sentVerificationTokens).toHaveLength(0);
  });

  it('silently no-ops for an already-verified account', async () => {
    await authService.register('already@example.com', 'password123', false);
    await authService.verifyEmail(sentVerificationTokens[0].token);
    sentVerificationTokens.length = 0;

    await authService.resendVerification('already@example.com');
    expect(sentVerificationTokens).toHaveLength(0);
  });
});

// ─── requestPasswordReset / resetPassword ────────────────────────────────────

describe('authService password reset flow', () => {
  it('requestPasswordReset emails a token and stores it hashed', async () => {
    const { user } = await authService.register('reset@example.com', 'old-password', false);

    await authService.requestPasswordReset('reset@example.com');

    expect(sentResetTokens).toHaveLength(1);
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(sentResetTokens[0].token); // stored hashed
  });

  it('requestPasswordReset silently no-ops for an unknown email (no enumeration)', async () => {
    await expect(authService.requestPasswordReset('ghost@example.com')).resolves.toBeUndefined();
    expect(sentResetTokens).toHaveLength(0);
  });

  it('resetPassword updates the hash so the new password logs in and the old one fails', async () => {
    await authService.register('change@example.com', 'old-password', false);
    await authService.requestPasswordReset('change@example.com');
    const rawToken = sentResetTokens[0].token;

    await authService.resetPassword(rawToken, 'brand-new-pw');

    await expect(authService.login('change@example.com', 'brand-new-pw')).resolves.toBeTruthy();
    await expect(authService.login('change@example.com', 'old-password')).rejects.toThrow(
      'INVALID_CREDENTIALS'
    );
  });

  it('a reset token is single-use', async () => {
    await authService.register('single@example.com', 'old-password', false);
    await authService.requestPasswordReset('single@example.com');
    const rawToken = sentResetTokens[0].token;

    await authService.resetPassword(rawToken, 'first-new-pw');
    await expect(authService.resetPassword(rawToken, 'second-new-pw')).rejects.toThrow(
      'INVALID_RESET_TOKEN'
    );
  });

  it('rejects an expired reset token', async () => {
    const { user } = await authService.register('stale@example.com', 'old-password', false);
    await authService.requestPasswordReset('stale@example.com');
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(authService.resetPassword(sentResetTokens[0].token, 'whatever-pw')).rejects.toThrow(
      'INVALID_RESET_TOKEN'
    );
  });

  // Issue #4: a single inbox must not be mail-bombable. The per-email guard caps
  // how many reset emails one address gets per window (default 3), suppressing
  // the send (and the token write) beyond that while keeping the generic outcome.
  it('throttles repeated reset requests for the same email (no mail-bombing)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { user } = await authService.register('bomb@example.com', 'old-password', false);

    // Five back-to-back requests; only the first three (default perEmailMax) send.
    for (let i = 0; i < 5; i++) {
      await authService.requestPasswordReset('bomb@example.com');
    }

    expect(sentResetTokens).toHaveLength(3);
    // The suppressed requests don't pile up token rows either.
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows.length).toBeLessThanOrEqual(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('requesting a new reset token invalidates the prior unused one', async () => {
    await authService.register('rotate@example.com', 'old-password', false);
    await authService.requestPasswordReset('rotate@example.com');
    const firstToken = sentResetTokens[0].token;

    await authService.requestPasswordReset('rotate@example.com');
    const secondToken = sentResetTokens[1].token;

    await expect(authService.resetPassword(firstToken, 'nope-pw-123')).rejects.toThrow(
      'INVALID_RESET_TOKEN'
    );
    await expect(authService.resetPassword(secondToken, 'yes-pw-12345')).resolves.toBeUndefined();
  });
});

// ─── purgeTokens ──────────────────────────────────────────────────────────────

describe('authService.purgeTokens', () => {
  it('purges used email verification tokens', async () => {
    await authService.register('purge-used-verify@example.com', 'password123', false);
    const rawToken = sentVerificationTokens[0].token;
    await authService.verifyEmail(rawToken);

    const result = await authService.purgeTokens();

    expect(result.deletedVerificationTokens).toBe(1);
    expect(result.deletedResetTokens).toBe(0);
    const remaining = await prisma.emailVerificationToken.findMany();
    expect(remaining).toHaveLength(0);
  });

  it('purges expired email verification tokens', async () => {
    const { user } = await authService.register('purge-expired-verify@example.com', 'password123', false);
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await authService.purgeTokens();

    expect(result.deletedVerificationTokens).toBe(1);
    expect(result.deletedResetTokens).toBe(0);
  });

  it('does not purge active (unused, non-expired) verification tokens', async () => {
    await authService.register('keep-active@example.com', 'password123', false);

    const result = await authService.purgeTokens();

    expect(result.deletedVerificationTokens).toBe(0);
    const remaining = await prisma.emailVerificationToken.findMany();
    expect(remaining).toHaveLength(1);
  });

  it('purges used password reset tokens', async () => {
    await authService.register('purge-used-reset@example.com', 'old-password', false);
    await authService.requestPasswordReset('purge-used-reset@example.com');
    const rawToken = sentResetTokens[0].token;
    await authService.resetPassword(rawToken, 'new-password');

    const result = await authService.purgeTokens();

    expect(result.deletedVerificationTokens).toBe(0);
    expect(result.deletedResetTokens).toBe(1);
  });

  it('purges expired password reset tokens', async () => {
    const { user } = await authService.register('purge-expired-reset@example.com', 'old-password', false);
    await authService.requestPasswordReset('purge-expired-reset@example.com');
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await authService.purgeTokens();

    expect(result.deletedResetTokens).toBe(1);
  });

  it('does not purge active (unused, non-expired) reset tokens', async () => {
    await authService.register('keep-reset@example.com', 'old-password', false);
    await authService.requestPasswordReset('keep-reset@example.com');

    const result = await authService.purgeTokens();

    expect(result.deletedResetTokens).toBe(0);
    const remaining = await prisma.passwordResetToken.findMany();
    expect(remaining).toHaveLength(1);
  });

  it('purges both token types in a single call', async () => {
    await authService.register('purge-both@example.com', 'password123', false);
    await authService.verifyEmail(sentVerificationTokens[0].token);

    const { user } = await authService.register('purge-both-2@example.com', 'old-password', false);
    await authService.requestPasswordReset('purge-both-2@example.com');
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await authService.purgeTokens();

    expect(result.deletedVerificationTokens).toBe(1);
    expect(result.deletedResetTokens).toBe(1);
  });

  it('returns zero counts when nothing matches', async () => {
    const result = await authService.purgeTokens();
    expect(result.deletedVerificationTokens).toBe(0);
    expect(result.deletedResetTokens).toBe(0);
  });
});

// ─── refreshSession ───────────────────────────────────────────────────────────

describe('authService.refreshSession', () => {
  beforeEach(async () => {
    await authService.register('login@example.com', 'correct-horse', false);
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

