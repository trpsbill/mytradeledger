// Focused tests for the "clean up demo data immediately on logout" behavior.
// authApi is mocked; no real network calls are made.

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../services/api';

vi.mock('../services/api', () => ({
  authApi: {
    getConfig: vi.fn(),
    demoLogin: vi.fn(),
    deleteDemoSession: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../services/betterstack', () => ({
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const TOKEN_KEY = 'mtl_token';

function fakeJwt() {
  // header.payload.signature — payload just needs a valid `exp` for the
  // provider's expiry-timer effect to parse without throwing.
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.sig`;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.getConfig).mockResolvedValue({ data: { signupsEnabled: true } });
  vi.mocked(authApi.deleteDemoSession).mockResolvedValue(undefined);
});

describe('AuthContext logout — demo cleanup', () => {
  it('deletes the demo session on logout for a demo user', async () => {
    vi.mocked(authApi.demoLogin).mockResolvedValue({
      token: fakeJwt(),
      user: { id: 'demo-1', email: 'demo-abc@demo.mytradeledger.local', isPaid: false, emailVerified: true, isDemo: true },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginAsDemo();
    });
    expect(result.current.user?.isDemo).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(authApi.deleteDemoSession).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('does not call deleteDemoSession when logging out with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(authApi.deleteDemoSession).not.toHaveBeenCalled();
  });
});
