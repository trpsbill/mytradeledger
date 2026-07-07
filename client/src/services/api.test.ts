import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsApi, authApi, ledgerApi, tokensApi } from './api';

// The api layer wraps fetch. These tests stub global.fetch and assert the
// request shape (URL, method, auth header, body) and response handling
// (JSON parse, 204 → undefined, !ok → throw) — the contract every page relies on.

const TOKEN_KEY = 'mtl_token';

function mockFetch(response: Partial<Response> & { jsonData?: unknown }) {
  const fn = vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonData ?? {},
    ...response,
  })) as unknown as typeof fetch;
  globalThis.fetch = fn;
  return fn as unknown as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request — URL, method, headers', () => {
  it('prefixes /api and sends JSON content-type', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await accountsApi.list();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/accounts?includeArchived=false');
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });

  it('omits the Authorization header when no token is stored', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await accountsApi.list();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches a Bearer token when one is stored', async () => {
    localStorage.setItem(TOKEN_KEY, 'abc123');
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await accountsApi.list();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('serialises the body and sets the method for a POST', async () => {
    const fetchMock = mockFetch({ jsonData: { data: { id: '1' } } });
    await accountsApi.create({ name: 'Brokerage' } as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/accounts');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: 'Brokerage' });
  });
});

describe('request — response handling', () => {
  it('returns the parsed JSON body on success', async () => {
    mockFetch({ jsonData: { data: [{ id: '1' }] } });
    const result = await accountsApi.list();
    expect(result).toEqual({ data: [{ id: '1' }] });
  });

  it('returns undefined on a 204 No Content', async () => {
    mockFetch({ status: 204, jsonData: undefined });
    const result = await accountsApi.delete('1');
    expect(result).toBeUndefined();
  });

  it('throws the server error message on a non-2xx response', async () => {
    mockFetch({ ok: false, status: 400, jsonData: { error: 'Bad symbol' } });
    await expect(ledgerApi.get('1')).rejects.toThrow('Bad symbol');
  });

  it('throws a generic message when the error body is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;
    await expect(ledgerApi.get('1')).rejects.toThrow('Request failed');
  });
});

describe('ledgerApi.list — query string building', () => {
  it('omits the query string when no params are given', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await ledgerApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ledger');
  });

  it('includes only defined params, skipping undefined ones', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await ledgerApi.list({ symbol: 'BTC', entryType: undefined, page: 2 } as any);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('symbol=BTC');
    expect(url).toContain('page=2');
    expect(url).not.toContain('entryType');
  });

  it('serialises limit and offset for pagination', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await ledgerApi.list({ limit: 25, offset: 50 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=50');
  });

  it('serialises all pagination params together with filters', async () => {
    const fetchMock = mockFetch({ jsonData: { data: [] } });
    await ledgerApi.list({ symbol: 'ETH', limit: 50, offset: 100 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('symbol=ETH');
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=100');
  });
});

describe('endpoint wiring', () => {
  it('tokensApi.revoke issues a DELETE to the token id', async () => {
    const fetchMock = mockFetch({ status: 204, jsonData: undefined });
    await tokensApi.revoke('tok_42');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/tokens/tok_42');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('authApi.refresh POSTs to /api/auth/refresh with the stored Bearer token', async () => {
    localStorage.setItem(TOKEN_KEY, 'session-jwt');
    const fetchMock = mockFetch({ jsonData: { data: { token: 'new-jwt' } } });

    const result = await authApi.refresh();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/refresh');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer session-jwt',
    });
    expect(result).toEqual({ token: 'new-jwt' });
  });

  it('authApi.refresh throws when no token is stored', async () => {
    await expect(authApi.refresh()).rejects.toThrow('No session token');
  });

  it('authApi.refresh throws with the server error message on failure', async () => {
    localStorage.setItem(TOKEN_KEY, 'session-jwt');
    mockFetch({ ok: false, status: 401, jsonData: { error: 'Session has expired' } });
    await expect(authApi.refresh()).rejects.toThrow('Session has expired');
  });

});

describe('request — 401 unauthorized event', () => {
  it('dispatches mtl:unauthorized on a 401 response', async () => {
    mockFetch({ ok: false, status: 401, jsonData: { error: 'Unauthorized' } });

    const handler = vi.fn();
    window.addEventListener('mtl:unauthorized', handler);
    try {
      await ledgerApi.list().catch(() => {});
      expect(handler).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('mtl:unauthorized', handler);
    }
  });

  it('does not dispatch mtl:unauthorized on non-401 errors', async () => {
    mockFetch({ ok: false, status: 400, jsonData: { error: 'Bad request' } });

    const handler = vi.fn();
    window.addEventListener('mtl:unauthorized', handler);
    try {
      await ledgerApi.list().catch(() => {});
      expect(handler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('mtl:unauthorized', handler);
    }
  });
});
