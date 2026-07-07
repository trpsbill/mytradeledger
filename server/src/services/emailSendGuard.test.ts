// Unit tests for the auth-email throttle + circuit breaker. These are pure
// (no DB, no network): a fake clock drives the sliding windows deterministically.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailSendGuard, type EmailSendGuardConfig } from './emailSendGuard';

const HOUR = 60 * 60 * 1000;

const baseConfig: EmailSendGuardConfig = {
  perEmailMax: 3,
  perEmailWindowMs: HOUR,
  globalMax: 5,
  globalWindowMs: HOUR,
  alertThreshold: 4,
};

// A controllable clock so window expiry is exercised without real time.
function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function makeGuard(overrides: Partial<EmailSendGuardConfig> = {}) {
  const clock = fakeClock();
  const guard = new EmailSendGuard({ ...baseConfig, ...overrides }, clock.now);
  return { guard, clock };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EmailSendGuard — per-email limit', () => {
  it('allows up to perEmailMax sends to one key, then denies', () => {
    const { guard } = makeGuard();

    for (let i = 0; i < baseConfig.perEmailMax; i++) {
      expect(guard.tryConsume('reset:a@example.com').allowed).toBe(true);
    }

    const denied = guard.tryConsume('reset:a@example.com');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('per-email');
  });

  it('keys are independent — one mail-bombed inbox does not block others', () => {
    const { guard } = makeGuard();

    // Exhaust the limit for a@.
    for (let i = 0; i < baseConfig.perEmailMax; i++) guard.tryConsume('reset:a@example.com');
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(false);

    // A different inbox is unaffected.
    expect(guard.tryConsume('reset:b@example.com').allowed).toBe(true);
  });

  it('frees slots once the per-email window slides past old sends', () => {
    const { guard, clock } = makeGuard();

    for (let i = 0; i < baseConfig.perEmailMax; i++) guard.tryConsume('reset:a@example.com');
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(false);

    // Just before expiry: still blocked.
    clock.advance(HOUR - 1);
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(false);

    // Past the window: the old hits drop off and a slot opens.
    clock.advance(2);
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(true);
  });

  it('namespaces per-email keys by category (reset vs verify) but shares the inbox budget separately', () => {
    const { guard } = makeGuard();

    for (let i = 0; i < baseConfig.perEmailMax; i++) {
      expect(guard.tryConsume('reset:a@example.com').allowed).toBe(true);
    }
    // reset: budget for a@ is spent, but verify: is a distinct key.
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(false);
    expect(guard.tryConsume('verify:a@example.com').allowed).toBe(true);
  });
});

describe('EmailSendGuard — global ceiling (circuit breaker)', () => {
  it('denies once globalMax is reached across distinct emails', () => {
    // High per-email max so the global ceiling is the only thing that can trip.
    const { guard } = makeGuard({ perEmailMax: 1000 });

    for (let i = 0; i < baseConfig.globalMax; i++) {
      expect(guard.tryConsume(`reset:user${i}@example.com`).allowed).toBe(true);
    }

    const denied = guard.tryConsume('reset:overflow@example.com');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('global');
  });

  it('global ceiling takes precedence over the per-email reason', () => {
    const { guard } = makeGuard({ perEmailMax: 1, globalMax: 2 });

    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(true); // global 1
    expect(guard.tryConsume('reset:b@example.com').allowed).toBe(true); // global 2 (ceiling)

    // c@ has never been seen (per-email would allow) but the global ceiling is hit.
    const denied = guard.tryConsume('reset:c@example.com');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('global');
  });

  it('a denied send does not consume a slot (count only reflects granted sends)', () => {
    const { guard } = makeGuard({ perEmailMax: 1, globalMax: 5 });

    guard.tryConsume('reset:a@example.com'); // granted, global = 1
    guard.tryConsume('reset:a@example.com'); // denied per-email, must not count
    expect(guard.globalCount()).toBe(1);
  });

  it('recovers after the global window slides', () => {
    const { guard, clock } = makeGuard({ perEmailMax: 1000 });

    for (let i = 0; i < baseConfig.globalMax; i++) guard.tryConsume(`reset:u${i}@example.com`);
    expect(guard.tryConsume('reset:x@example.com').allowed).toBe(false);

    clock.advance(HOUR + 1);
    expect(guard.tryConsume('reset:x@example.com').allowed).toBe(true);
  });
});

describe('EmailSendGuard — alerting', () => {
  it('emits a single alert when global volume crosses the threshold', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { guard } = makeGuard({ perEmailMax: 1000, alertThreshold: 4, globalMax: 100 });

    for (let i = 0; i < 3; i++) guard.tryConsume(`reset:u${i}@example.com`);
    expect(warn).not.toHaveBeenCalled(); // below threshold

    guard.tryConsume('reset:u3@example.com'); // count = 4 → crosses
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('threshold crossed');

    // Sustained volume does not spam a line per send.
    guard.tryConsume('reset:u4@example.com');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('re-arms the alert after the window drains below the threshold', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { guard, clock } = makeGuard({ perEmailMax: 1000, alertThreshold: 2, globalMax: 100 });

    guard.tryConsume('reset:a@example.com');
    guard.tryConsume('reset:b@example.com'); // crosses → alert 1
    expect(warn).toHaveBeenCalledTimes(1);

    // Drain the window, then spike again.
    clock.advance(HOUR + 1);
    guard.tryConsume('reset:c@example.com');
    guard.tryConsume('reset:d@example.com'); // crosses again → alert 2
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('EmailSendGuard — reset()', () => {
  it('clears all state', () => {
    const { guard } = makeGuard();
    for (let i = 0; i < baseConfig.perEmailMax; i++) guard.tryConsume('reset:a@example.com');
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(false);

    guard.reset();
    expect(guard.globalCount()).toBe(0);
    expect(guard.tryConsume('reset:a@example.com').allowed).toBe(true);
  });
});
