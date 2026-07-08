// Client-side solver for the self-hosted proof-of-work challenge (TRE-26).
//
// When an auth endpoint demands a challenge (HTTP 403 `challengeRequired`), the
// form fetches a puzzle from GET /api/auth/challenge, brute-forces the secret
// number in the browser (the "work"), and resubmits the original request with
// the solution token. Hashing uses the Web Crypto SubtleCrypto API — no deps.

export interface PowChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  maxnumber: number;
  signature: string;
}

const API_BASE = '/api';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function fetchChallenge(): Promise<PowChallenge> {
  const res = await fetch(`${API_BASE}/auth/challenge`);
  if (!res.ok) throw new Error('Could not load the verification challenge');
  return res.json();
}

// Scan n = 0,1,2,… until SHA-256(salt + n) matches the published challenge, then
// return the Altcha-style payload (base64 JSON) the server expects as the token.
export async function solveChallenge(ch: PowChallenge): Promise<string> {
  if (ch.algorithm !== 'SHA-256') {
    throw new Error(`Unsupported challenge algorithm: ${ch.algorithm}`);
  }
  for (let n = 0; n <= ch.maxnumber; n++) {
    if ((await sha256Hex(ch.salt + n)) === ch.challenge) {
      const payload = {
        algorithm: ch.algorithm,
        challenge: ch.challenge,
        number: n,
        salt: ch.salt,
        signature: ch.signature,
      };
      return btoa(JSON.stringify(payload));
    }
  }
  throw new Error('Could not solve the verification challenge');
}

// Convenience: fetch a challenge and solve it, returning the submit-ready token.
export async function solvePowChallenge(): Promise<string> {
  return solveChallenge(await fetchChallenge());
}

// Runs `doFetch`, and if the server answers 403 `challengeRequired`, solves a
// PoW and transparently retries once with the solution in `x-challenge-token`.
// `onSolving` fires when work begins so the UI can show a "verifying" state.
// `doFetch` receives the token to attach (undefined on the first attempt).
export async function withPowRetry(
  doFetch: (challengeToken?: string) => Promise<Response>,
  onSolving?: () => void
): Promise<Response> {
  const res = await doFetch();
  if (res.status !== 403) return res;

  const body = await res.clone().json().catch(() => null);
  if (!body || body.challengeRequired !== true) return res;

  onSolving?.();
  const token = await solvePowChallenge();
  return doFetch(token);
}
