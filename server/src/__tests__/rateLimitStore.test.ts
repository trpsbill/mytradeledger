import { afterEach, describe, expect, it, vi } from 'vitest';

// Avoid any real Redis socket: rate-limit-redis eagerly issues SCRIPT LOAD when
// a RedisStore is constructed, so the fake client just resolves commands.
vi.mock('ioredis', () => {
  class FakeRedis {
    on() {
      return this;
    }
    call() {
      return Promise.resolve('fake-sha');
    }
    disconnect() {}
  }
  return { default: FakeRedis };
});

import {
  __resetRateLimitClientForTests,
  createRateLimitStore,
} from '../config/rateLimitStore';

const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

describe('createRateLimitStore', () => {
  afterEach(async () => {
    await __resetRateLimitClientForTests();
    if (ORIGINAL_REDIS_URL === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = ORIGINAL_REDIS_URL;
    }
  });

  it('returns undefined when REDIS_URL is not set (in-memory fallback)', () => {
    delete process.env.REDIS_URL;
    expect(createRateLimitStore('login')).toBeUndefined();
  });

  it('returns a shared store when REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const store = createRateLimitStore('login');
    expect(store).toBeDefined();
    // express-rate-limit Store contract.
    expect(typeof store?.increment).toBe('function');
    expect(typeof store?.resetKey).toBe('function');
  });

  it('isolates counters per limiter via distinct prefixes', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const login = createRateLimitStore('login') as { prefix?: string };
    const register = createRateLimitStore('register') as { prefix?: string };
    expect(login.prefix).toBe('rl:login:');
    expect(register.prefix).toBe('rl:register:');
  });
});
