import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveChallenge, withPowRetry, type PowChallenge } from './pow';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Build a challenge whose solution is a known number, mirroring what the server
// issues (signature is opaque to the solver, so a placeholder is fine here).
async function makeChallenge(number: number, maxnumber: number): Promise<PowChallenge> {
  const salt = `abc123?expires=${9999999999999}`;
  const challenge = await sha256Hex(salt + number);
  return { algorithm: 'SHA-256', challenge, salt, maxnumber, signature: 'sig' };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('solveChallenge', () => {
  it('finds the nonce and returns a decodable base64 payload', async () => {
    const ch = await makeChallenge(42, 100);
    const token = await solveChallenge(ch);
    const payload = JSON.parse(atob(token));
    expect(payload.number).toBe(42);
    expect(payload.challenge).toBe(ch.challenge);
    expect(payload.salt).toBe(ch.salt);
    expect(payload.signature).toBe('sig');
    // The submitted number must hash back to the published challenge.
    expect(await sha256Hex(payload.salt + payload.number)).toBe(ch.challenge);
  });

  it('rejects an unsupported algorithm', async () => {
    const ch = await makeChallenge(1, 10);
    await expect(solveChallenge({ ...ch, algorithm: 'MD5' })).rejects.toThrow();
  });
});

describe('withPowRetry', () => {
  it('passes through a non-403 response without solving', async () => {
    const doFetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const res = await withPowRetry(doFetch);
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('solves and retries with a token on 403 challengeRequired', async () => {
    const ch = await makeChallenge(7, 50);
    // The solver fetches the puzzle from /api/auth/challenge.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(ch), { status: 200 })
    );

    const onSolving = vi.fn();
    const doFetch = vi.fn(async (token?: string) => {
      if (!token) {
        return new Response(JSON.stringify({ challengeRequired: true }), { status: 403 });
      }
      return new Response(JSON.stringify({ ok: true, token }), { status: 200 });
    });

    const res = await withPowRetry(doFetch, onSolving);
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
    expect(onSolving).toHaveBeenCalledTimes(1);
    // Second call carried a solved token.
    const sentToken = doFetch.mock.calls[1][0];
    expect(typeof sentToken).toBe('string');
    expect(JSON.parse(atob(sentToken as string)).number).toBe(7);
  });

  it('does not retry on a 403 that is not a challenge', async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    const res = await withPowRetry(doFetch);
    expect(res.status).toBe(403);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });
});
