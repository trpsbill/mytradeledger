import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import type { ChallengeProvider } from './challenge';

// Self-hosted proof-of-work ChallengeProvider (Altcha-compatible / hashcash).
// Decision: TRE-25 — no paid 3rd party, no recurring cost, no vendor lock-in.
//
// How it works (Altcha algorithm):
//   1. issuePowChallenge() picks a secret number in [0, maxnumber] and a random,
//      expiry-stamped salt, then publishes challenge = SHA-256(salt + number)
//      together with an HMAC signature over that hash. The number itself is NOT
//      sent — the client must find it.
//   2. The browser brute-forces n = 0,1,2,… until SHA-256(salt + n) === challenge.
//      That linear scan is the "work"; difficulty scales with maxnumber.
//   3. verify() recomputes the hash from the submitted number and re-checks the
//      HMAC, so the server keeps NO per-challenge state — the signature proves we
//      issued it and the salt's `expires` bounds replay. This makes it safe across
//      multiple instances and restarts as long as they share CHALLENGE_HMAC_SECRET.
//
// Dependency-light: only Node's built-in crypto, no npm package.

const ALGORITHM = 'SHA-256';

// Difficulty: the upper bound for the secret number. The client performs, on
// average, maxnumber/2 SHA-256 hashes to solve. ~50k keeps a legitimate user
// under ~1s in-browser while still taxing a high-volume automated attacker.
const DEFAULT_MAX_NUMBER = 50_000;

// How long an issued challenge stays solvable. Short enough to bound replay,
// long enough for a human to fetch → solve → submit on a slow device.
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000;

function maxNumber(): number {
  const raw = Number(process.env.CHALLENGE_POW_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_NUMBER;
}

function expiryMs(): number {
  const raw = Number(process.env.CHALLENGE_POW_EXPIRY_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_EXPIRY_MS;
}

// HMAC key that signs every challenge. Prefer a dedicated secret; fall back to
// JWT_SECRET so dev/test work without extra config. Both issue and verify read
// this lazily so tests can set the env before exercising the provider.
function hmacSecret(): string {
  return process.env.CHALLENGE_HMAC_SECRET || process.env.JWT_SECRET || 'insecure-dev-challenge-secret';
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function sign(challenge: string): string {
  return createHmac('sha256', hmacSecret()).update(challenge).digest('hex');
}

// Constant-time hex compare that never throws on length mismatch.
function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export interface PowChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  maxnumber: number;
  signature: string;
}

// Build a fresh challenge. Returned verbatim to the client by GET /auth/challenge.
export function issuePowChallenge(): PowChallenge {
  const max = maxNumber();
  // Stamp the salt with an absolute expiry (Altcha convention: query params on
  // the salt) so verify() can reject stale solutions without server-side storage.
  const expires = Date.now() + expiryMs();
  const salt = `${randomBytes(12).toString('hex')}?expires=${expires}`;
  // randomInt is upper-exclusive; +1 so the full inclusive [0, max] range is used.
  const number = randomInt(0, max + 1);
  const challenge = sha256Hex(salt + number);
  return { algorithm: ALGORITHM, challenge, salt, maxnumber: max, signature: sign(challenge) };
}

interface PowSolution {
  algorithm?: string;
  challenge?: string;
  salt?: string;
  number?: number;
  signature?: string;
}

// Decode the token the client submits. Altcha sends a base64-encoded JSON blob;
// we also accept raw JSON for flexibility. Returns null on any malformed input.
function decodeSolution(token: string): PowSolution | null {
  const tryParse = (s: string): PowSolution | null => {
    try {
      const obj = JSON.parse(s);
      return obj && typeof obj === 'object' ? (obj as PowSolution) : null;
    } catch {
      return null;
    }
  };
  const trimmed = token.trim();
  if (trimmed.startsWith('{')) return tryParse(trimmed);
  try {
    return tryParse(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function saltExpired(salt: string): boolean {
  const match = /(?:\?|&)expires=(\d+)/.exec(salt);
  if (!match) return false; // No expiry stamp → don't reject on that basis.
  return Number(match[1]) <= Date.now();
}

// ChallengeProvider implementation. Verifies a submitted PoW solution. Per the
// interface contract it never throws on bad input — it returns false.
export const powChallengeProvider: ChallengeProvider = {
  name: 'pow',
  async verify(token) {
    if (typeof token !== 'string' || token.trim().length === 0) return false;
    const sol = decodeSolution(token);
    if (!sol) return false;

    const { algorithm, challenge, salt, number, signature } = sol;
    if (algorithm !== ALGORITHM) return false;
    if (typeof challenge !== 'string' || typeof salt !== 'string') return false;
    if (typeof signature !== 'string') return false;
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0) return false;
    if (saltExpired(salt)) return false;

    // 1. The signature proves WE issued this challenge (and that `challenge`
    //    hasn't been tampered with). 2. Re-deriving the hash from the claimed
    //    number proves the client actually found the solution.
    if (!safeEqualHex(signature, sign(challenge))) return false;
    if (!safeEqualHex(challenge, sha256Hex(salt + number))) return false;
    return true;
  },
};
