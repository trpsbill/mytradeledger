import { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { authRateLimit as buildLimiter } from './rateLimit';

// Centralised throttling for the public, unauthenticated auth endpoints.
//
// Two complementary layers protect login:
//   1. Per-IP    — blunts a single host hammering the endpoint.
//   2. Per-account — keyed on the submitted email, so a *distributed*
//      credential-stuffing run against one account is throttled even when each
//      request comes from a different IP (the realistic botnet attack; see #6).
//
// Both login layers set `skipSuccessfulRequests` so a legitimate user typing the
// right password is never counted toward — and so never locked out by — their
// own successful logins.
//
// Store wiring (#5): every limiter is built through `buildLimiter` (the shared
// `authRateLimit` factory), which injects the pluggable store — Redis when
// REDIS_URL is set, express-rate-limit's per-process MemoryStore otherwise. Each
// limiter passes a distinct `name` so their Redis counters don't collide. This
// keeps single-instance behaviour identical while making the counters global
// across instances once Redis is configured.

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Max failed login attempts, per account, before the account is temporarily
// locked. Deliberately low: only *failures* count (skipSuccessfulRequests), so a
// real user never approaches it, while a stuffing run burns it almost immediately.
export const LOGIN_ACCOUNT_MAX = 5;

// Bucket key for the per-account login limiter. Normalises the submitted email
// the same way authService does (lowercase + trim) so casing/padding can't be
// used to dodge the lock. Falls back to the source IP when no email was supplied
// (malformed request) so those still get throttled rather than sharing one
// global empty-string bucket.
export function loginAccountKey(req: Request): string {
  const raw = req.body && typeof req.body.email === 'string' ? req.body.email : '';
  const email = raw.trim().toLowerCase();
  return email ? `acct:${email}` : `ip:${req.ip ?? 'unknown'}`;
}

// Factory (not a bare singleton) so tests can construct an instance with a small
// `max`/`windowMs` without waiting on production thresholds. The auth routes call
// it with no args to get the production-configured limiter.
export function makeAccountLoginLimiter(overrides: Partial<Options> = {}) {
  return buildLimiter('login-account', {
    windowMs: FIFTEEN_MIN,
    max: LOGIN_ACCOUNT_MAX,
    // Only failed logins count toward the per-account lock.
    skipSuccessfulRequests: true,
    keyGenerator: loginAccountKey,
    message: {
      error:
        'Too many failed login attempts for this account, please try again later',
    },
    // The primary key is the email; the req.ip fallback is only hit for
    // malformed (email-less) requests, so the IPv6-aggregation check that warns
    // about raw-IP keys isn't relevant here.
    validate: { ip: false },
    ...overrides,
  });
}

// Per-IP login throttle. Complements the per-account limiter above and likewise
// ignores successful logins so a busy shared-NAT office isn't penalised for
// everyone signing in correctly.
export const loginIpLimiter = buildLimiter('login-ip', {
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later' },
});

export const registerLimiter = buildLimiter('register', {
  windowMs: ONE_HOUR,
  max: 10,
  message: { error: 'Too many accounts created from this IP, please try again later' },
});
