import rateLimit, { type Options } from 'express-rate-limit';
import { createRateLimitStore } from '../config/rateLimitStore';

// Shared factory for the auth/token rate limiters. Applies the project-wide
// header defaults and wires in the pluggable store (Redis when REDIS_URL is
// set, in-memory otherwise) so every limiter is durable in the same way.
export function authRateLimit(name: string, options: Partial<Options>) {
  const store = createRateLimitStore(name);
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
    // Only override the default MemoryStore when a shared store is configured.
    ...(store ? { store } : {}),
  });
}
