import type { Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';

// Pluggable backing store for the auth rate limiters.
//
// Default (no REDIS_URL): return `undefined` so express-rate-limit keeps its
// built-in per-process MemoryStore. This preserves today's behaviour for a
// single-instance deployment and needs no extra infra.
//
// When REDIS_URL is set: counters live in Redis, so they survive restarts/
// deploys (an attacker can't reset their budget by waiting for a redeploy) and
// are shared across every app instance (N instances no longer multiply the
// effective limit by N). This is opt-in — nothing connects to Redis until the
// env var is present.

let client: Redis | undefined;

function getClient(): Redis | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  if (!client) {
    // lazyConnect: don't open a socket until the first command, so the process
    // still boots if Redis is briefly unavailable at startup.
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    client.on('error', (err) => {
      // Surface connectivity problems without crashing the request path.
      console.error('[ratelimit] redis store error:', err.message);
    });
  }
  return client;
}

/**
 * Build a rate-limit store for a single limiter.
 *
 * @param name unique key per limiter (e.g. 'login') so different limiters don't
 *   share the same Redis counters.
 * @returns a Redis-backed Store when REDIS_URL is configured, otherwise
 *   `undefined` so the caller falls back to express-rate-limit's MemoryStore.
 */
export function createRateLimitStore(name: string): Store | undefined {
  const redis = getClient();
  if (!redis) return undefined;
  return new RedisStore({
    // rate-limit-redis forwards each command as (command, ...args); ioredis'
    // `call` takes that same shape.
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as unknown as Promise<RedisReply>,
    prefix: `rl:${name}:`,
  });
}

/** Test-only: drop the cached client so env changes take effect between tests. */
export async function __resetRateLimitClientForTests(): Promise<void> {
  if (client) {
    client.disconnect();
    client = undefined;
  }
}
