// Unit tests for the self-hosted proof-of-work ChallengeProvider (TRE-26):
// issue → solve → verify happy path, wrong-nonce / tampered-signature rejection,
// expiry, and that the failure-triggered flow accepts a solved token while the
// CHALLENGE_ENABLED flag fully gates it. No DB, no network.

import { createHash } from 'crypto';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { issuePowChallenge, powChallengeProvider, type PowChallenge } from './powChallenge';
import { challengeAfterFailures } from './challenge';

// A stable secret so issue/verify agree within the test process.
beforeEach(() => {
  process.env.CHALLENGE_HMAC_SECRET = 'test-pow-secret';
  delete process.env.CHALLENGE_POW_MAX;
  delete process.env.CHALLENGE_POW_EXPIRY_MS;
});

// Solve a challenge exactly as the browser does: scan n upward until the hash of
// (salt + n) matches, then encode the Altcha-style payload as the token.
function solve(ch: PowChallenge): string {
  for (let n = 0; n <= ch.maxnumber; n++) {
    const hash = createHash('sha256').update(ch.salt + n).digest('hex');
    if (hash === ch.challenge) {
      const payload = {
        algorithm: ch.algorithm,
        challenge: ch.challenge,
        number: n,
        salt: ch.salt,
        signature: ch.signature,
      };
      return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    }
  }
  throw new Error('no solution found within maxnumber');
}

describe('powChallengeProvider (issue + verify)', () => {
  it('issues a well-formed challenge', () => {
    process.env.CHALLENGE_POW_MAX = '1000';
    const ch = issuePowChallenge();
    expect(ch.algorithm).toBe('SHA-256');
    expect(ch.maxnumber).toBe(1000);
    expect(ch.challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(ch.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(ch.salt).toContain('expires=');
  });

  it('verifies a correctly solved challenge (happy path)', async () => {
    process.env.CHALLENGE_POW_MAX = '2000';
    const ch = issuePowChallenge();
    const token = solve(ch);
    expect(await powChallengeProvider.verify(token, {} as any)).toBe(true);
  });

  it('rejects a wrong nonce (tampered number)', async () => {
    process.env.CHALLENGE_POW_MAX = '2000';
    const ch = issuePowChallenge();
    const token = solve(ch);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    payload.number = payload.number + 1; // no longer hashes to `challenge`
    const tampered = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    expect(await powChallengeProvider.verify(tampered, {} as any)).toBe(false);
  });

  it('rejects a forged signature (challenge not issued by us)', async () => {
    // Attacker fabricates a challenge whose number they know but cannot sign.
    const salt = `deadbeef?expires=${Date.now() + 60_000}`;
    const number = 7;
    const challenge = createHash('sha256').update(salt + number).digest('hex');
    const payload = { algorithm: 'SHA-256', challenge, number, salt, signature: 'f'.repeat(64) };
    const token = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    expect(await powChallengeProvider.verify(token, {} as any)).toBe(false);
  });

  it('rejects an expired challenge', async () => {
    process.env.CHALLENGE_POW_MAX = '2000';
    process.env.CHALLENGE_POW_EXPIRY_MS = '1';
    const ch = issuePowChallenge();
    const token = solve(ch);
    await new Promise((r) => setTimeout(r, 5));
    expect(await powChallengeProvider.verify(token, {} as any)).toBe(false);
  });

  it('rejects a replayed challenge whose expiry stamp was edited to un-expire it', async () => {
    // Attack: solve a challenge, let it expire, then bump the `expires=` value in
    // the salt to make saltExpired() pass again. The salt is bound into the hash
    // (challenge = SHA-256(salt + number)), so editing it must break verification.
    process.env.CHALLENGE_POW_MAX = '2000';
    process.env.CHALLENGE_POW_EXPIRY_MS = '1';
    const ch = issuePowChallenge();
    const token = solve(ch);
    await new Promise((r) => setTimeout(r, 5));

    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    payload.salt = payload.salt.replace(/expires=\d+/, `expires=${Date.now() + 60_000}`);
    const tampered = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    expect(await powChallengeProvider.verify(tampered, {} as any)).toBe(false);
  });

  it('rejects empty, malformed, and non-string tokens', async () => {
    expect(await powChallengeProvider.verify('', {} as any)).toBe(false);
    expect(await powChallengeProvider.verify('   ', {} as any)).toBe(false);
    expect(await powChallengeProvider.verify('not-base64-json', {} as any)).toBe(false);
    expect(await powChallengeProvider.verify(undefined, {} as any)).toBe(false);
  });
});

// End-to-end through the failure-triggered middleware, proving the real provider
// gates access after the threshold and that the flag turns it all off.
describe('powChallengeProvider via challengeAfterFailures', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
    );
  });

  async function startApp(enabled: boolean): Promise<string> {
    process.env.CHALLENGE_POW_MAX = '2000';
    const app = express();
    app.use(express.json());
    const challenge = challengeAfterFailures({
      enabled,
      threshold: 2,
      provider: powChallengeProvider,
    });
    app.get('/challenge', (_req, res) => res.json(issuePowChallenge()));
    app.post('/login', challenge, (req, res) => {
      if (req.body?.password === 'correct') return res.json({ ok: true });
      return res.status(401).json({ error: 'bad' });
    });
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async function login(base: string, password: string, challengeToken?: string) {
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(challengeToken ? { 'x-challenge-token': challengeToken } : {}),
      },
      body: JSON.stringify({ email: 'target@example.com', password }),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  }

  it('demands a PoW after the threshold and accepts a real solution', async () => {
    const base = await startApp(true);
    expect((await login(base, 'wrong')).status).toBe(401);
    expect((await login(base, 'wrong')).status).toBe(401);

    // Threshold crossed → blocked without a token.
    const blocked = await login(base, 'wrong');
    expect(blocked.status).toBe(403);
    expect(blocked.json.challengeRequired).toBe(true);
    expect(blocked.json.provider).toBe('pow');

    // Fetch a real challenge, solve it, and the request reaches the handler.
    const chRes = await fetch(`${base}/challenge`);
    const ch = (await chRes.json()) as PowChallenge;
    const token = solve(ch);
    expect((await login(base, 'wrong', token)).status).toBe(401); // gate passed, pw still wrong
    expect((await login(base, 'correct', token)).status).toBe(200);
  });

  it('is fully gated off when disabled (CHALLENGE_ENABLED=false equivalent)', async () => {
    const base = await startApp(false);
    // Far past the threshold, never demands a challenge.
    for (let i = 0; i < 5; i++) {
      expect((await login(base, 'wrong')).status).toBe(401);
    }
  });
});
