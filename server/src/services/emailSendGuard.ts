// Application-level throttle + circuit breaker for outbound auth emails
// (password reset, verification resend). This sits *behind* the per-IP
// express-rate-limit middleware and closes two gaps that per-IP limiting can't:
//
//   1. Per-email mail-bombing — a distributed source (many IPs) can target a
//      single inbox with reset emails. A limit keyed on the *target email*
//      caps how many auth emails any one address receives in a window,
//      regardless of how many source IPs drive the requests.
//   2. Global cost / quota blowout — even spread thin across emails and IPs,
//      total send volume can run up Mailjet cost, exhaust the send quota
//      (blocking real transactional mail), and damage sender reputation. A
//      global ceiling acts as a circuit breaker: once tripped, further auth
//      sends are suppressed until the window drains.
//
// State is in-memory (per process), matching the existing per-IP limiter. That
// is a deliberate trade-off: it resets on restart and isn't shared across
// instances, but it needs no external dependency and meaningfully raises the
// cost of abuse. A shared store (e.g. Redis) would be the next step if the app
// is ever horizontally scaled.

export type DenyReason = 'per-email' | 'global';

export interface ConsumeResult {
  /** Whether a send slot was granted (and consumed). */
  allowed: boolean;
  /** Which limit blocked the send, when `allowed` is false. */
  reason?: DenyReason;
}

export interface EmailSendGuardConfig {
  /** Max sends allowed to a single key within `perEmailWindowMs`. */
  perEmailMax: number;
  perEmailWindowMs: number;
  /** Global ceiling: max sends across all keys within `globalWindowMs`. */
  globalMax: number;
  globalWindowMs: number;
  /**
   * Emit an alert log once the count of global sends in the current window
   * reaches this value. Re-arms after the window drains below the threshold so
   * sustained abuse keeps surfacing without spamming a line per send.
   */
  alertThreshold: number;
}

/**
 * Sliding-window send limiter. Each `tryConsume` prunes expired hits, checks the
 * global ceiling first (cheapest way to shed load under a flood) then the
 * per-key limit, and only records a hit when the send is actually granted.
 */
export class EmailSendGuard {
  private readonly perKeyHits = new Map<string, number[]>();
  private globalHits: number[] = [];
  private alerted = false;

  constructor(
    private readonly config: EmailSendGuardConfig,
    // Injectable clock keeps the sliding-window behaviour deterministic in tests.
    private readonly now: () => number = () => Date.now()
  ) {}

  /**
   * Attempt to consume one send slot for `key` (typically `"<category>:<email>"`).
   * Returns `{ allowed: true }` and records the hit when within both limits,
   * otherwise `{ allowed: false, reason }` and records nothing.
   */
  tryConsume(key: string): ConsumeResult {
    const t = this.now();

    this.globalHits = prune(this.globalHits, t - this.config.globalWindowMs);
    if (this.globalHits.length >= this.config.globalMax) {
      return { allowed: false, reason: 'global' };
    }

    const keyHits = prune(this.perKeyHits.get(key) ?? [], t - this.config.perEmailWindowMs);
    if (keyHits.length >= this.config.perEmailMax) {
      // Persist the pruned list so the map doesn't grow unbounded with stale ts.
      this.perKeyHits.set(key, keyHits);
      return { allowed: false, reason: 'per-email' };
    }

    keyHits.push(t);
    this.perKeyHits.set(key, keyHits);
    this.globalHits.push(t);

    this.maybeAlert();

    return { allowed: true };
  }

  /** Number of global sends recorded in the current window (for diagnostics). */
  globalCount(): number {
    return prune(this.globalHits, this.now() - this.config.globalWindowMs).length;
  }

  /** Clears all in-memory state. Intended for test isolation. */
  reset(): void {
    this.perKeyHits.clear();
    this.globalHits = [];
    this.alerted = false;
  }

  private maybeAlert(): void {
    const count = this.globalHits.length;
    if (count >= this.config.alertThreshold) {
      if (!this.alerted) {
        this.alerted = true;
        const windowMin = Math.round(this.config.globalWindowMs / 60000);
        console.warn(
          `[email][alert] auth email volume threshold crossed: ${count} sends in the last ` +
            `~${windowMin}m (ceiling ${this.config.globalMax}). Possible abuse — investigate.`
        );
      }
    } else if (count < this.config.alertThreshold) {
      // Re-arm so a later spike alerts again.
      this.alerted = false;
    }
  }
}

/** Returns the subset of `hits` at or after `cutoff` (ascending timestamps). */
function prune(hits: number[], cutoff: number): number[] {
  // Hits are pushed in time order, so drop the expired prefix.
  let i = 0;
  while (i < hits.length && hits[i] < cutoff) i++;
  return i === 0 ? hits : hits.slice(i);
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const HOUR_MS = 60 * 60 * 1000;

// Shared singleton guarding all auth-email sends. Per-email keys are namespaced
// by category (e.g. `reset:`, `verify:`) while every send counts against one
// global ceiling, so the circuit breaker caps total auth-email cost.
export const authEmailGuard = new EmailSendGuard({
  perEmailMax: intFromEnv('AUTH_EMAIL_PER_EMAIL_MAX', 3),
  perEmailWindowMs: intFromEnv('AUTH_EMAIL_PER_EMAIL_WINDOW_MS', HOUR_MS),
  globalMax: intFromEnv('AUTH_EMAIL_GLOBAL_MAX', 100),
  globalWindowMs: intFromEnv('AUTH_EMAIL_GLOBAL_WINDOW_MS', HOUR_MS),
  alertThreshold: intFromEnv('AUTH_EMAIL_ALERT_THRESHOLD', 80),
});
