import type { Request, Response, NextFunction } from 'express';

// Anti-automation challenge (CAPTCHA / proof-of-work) for the public auth
// endpoints, demanded only *after* repeated failures so normal users never see
// it.
//
// DECISION PENDING (TRE-21 / #6): which provider backs this is the CEO's call.
// Real CAPTCHA providers (hCaptcha, reCAPTCHA, Turnstile) carry a 3rd-party /
// cost dependency, so we do NOT commit to one here. What ships is the *interface*
// plus a no-cost stub, and the wiring is OFF by default (CHALLENGE_ENABLED).
// Once a provider is chosen, implement ChallengeProvider for it and flip the env
// flag — no route changes required.

export interface ChallengeProvider {
  readonly name: string;
  // Resolve true when `token` proves a human / sufficient work factor for this
  // request, false otherwise. Must not throw for an invalid token — return false.
  verify(token: string | undefined, req: Request): Promise<boolean>;
}

// No-cost placeholder. Accepts any non-empty token. It provides NO real
// protection — it exists so the failure-triggered challenge flow is wired
// end-to-end and unit-testable. Replace once a provider is chosen.
export const stubChallengeProvider: ChallengeProvider = {
  name: 'stub',
  async verify(token) {
    return typeof token === 'string' && token.trim().length > 0;
  },
};

export interface ChallengeOptions {
  provider?: ChallengeProvider;
  // Failures (within `windowMs`) for one key before a challenge is demanded.
  threshold?: number;
  windowMs?: number;
  // Throttle key. Defaults to normalised email, falling back to source IP.
  keyGenerator?: (req: Request) => string;
  // Master switch. Now that a real provider has shipped (TRE-26), the challenge
  // is ON by default and only disabled by an explicit CHALLENGE_ENABLED=false,
  // which fully restores the prior challenge-free behavior.
  enabled?: boolean;
}

function defaultKey(req: Request): string {
  const raw = req.body && typeof req.body.email === 'string' ? req.body.email : '';
  const email = raw.trim().toLowerCase();
  return email ? `acct:${email}` : `ip:${req.ip ?? 'unknown'}`;
}

// Middleware factory. When enabled, it counts auth failures per key and, once the
// threshold is crossed, requires a valid challenge token (header
// `x-challenge-token` or body `challengeToken`) on subsequent attempts until a
// success resets the counter.
//
// State is an in-memory Map (per-process), mirroring the rate limiters. A
// multi-instance deployment needs the shared store from #5 for the count to be
// global; noted so it isn't mistaken for cross-instance protection.
export function challengeAfterFailures(opts: ChallengeOptions = {}) {
  const provider = opts.provider ?? stubChallengeProvider;
  const threshold = opts.threshold ?? 5;
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const enabled = opts.enabled ?? process.env.CHALLENGE_ENABLED !== 'false';
  const keyOf = opts.keyGenerator ?? defaultKey;

  const failures = new Map<string, { count: number; resetAt: number }>();

  function currentCount(key: string, now: number): number {
    const entry = failures.get(key);
    if (!entry) return 0;
    if (entry.resetAt <= now) {
      failures.delete(key);
      return 0;
    }
    return entry.count;
  }

  function recordFailure(key: string, now: number) {
    const entry = failures.get(key);
    if (!entry || entry.resetAt <= now) {
      failures.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }
  }

  return async function challenge(req: Request, res: Response, next: NextFunction) {
    if (!enabled) return next();

    const now = Date.now();
    const key = keyOf(req);

    if (currentCount(key, now) >= threshold) {
      const token =
        req.header('x-challenge-token') ??
        (req.body && typeof req.body.challengeToken === 'string'
          ? req.body.challengeToken
          : undefined);
      const ok = await provider.verify(token, req).catch(() => false);
      if (!ok) {
        return res.status(403).json({
          error: 'Additional verification required',
          challengeRequired: true,
          provider: provider.name,
        });
      }
    }

    // Drive future challenges from the outcome of this attempt: auth failures
    // (and hard throttles) accrue, any success clears the slate for this key.
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 429) {
        recordFailure(key, Date.now());
      } else if (res.statusCode < 400) {
        failures.delete(key);
      }
    });

    next();
  };
}
