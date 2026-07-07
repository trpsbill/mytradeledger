import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { withPowRetry } from '../services/pow';
import { authApi } from '../services/api';

interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface SessionWarning {
  expiresAt: number; // ms since epoch
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  sessionWarning: SessionWarning | null;
  signupsEnabled: boolean;
  login: (email: string, password: string, onSolving?: () => void) => Promise<void>;
  register: (
    email: string,
    password: string,
    onSolving?: () => void
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  keepAlive: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'mtl_token';
const API_BASE = '/api';
// Show warning this many ms before token expiry
const WARN_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
// Silently refresh only if the user was active within this window when the warn
// timer fires. Must be < (IDLE_TIMEOUT − WARN_BEFORE_EXPIRY_MS) so that a
// fully idle user can never silently refresh on the first token window.
const ACTIVE_WITHIN_MS = WARN_BEFORE_EXPIRY_MS;

function parseTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function authRequest(path: string, body: object, onSolving?: () => void) {
  const res = await withPowRetry(
    (challengeToken) =>
      fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(challengeToken ? { 'x-challenge-token': challengeToken } : {}),
        },
        body: JSON.stringify(body),
      }),
    onSolving
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data as { token: string; user: AuthUser };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<SessionWarning | null>(null);
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  // Start loading only if there's a stored token that needs to be verified.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const lastActivityAt = useRef(0);

  // On mount, fetch signup config
  useEffect(() => {
    authApi.getConfig()
      .then(res => setSignupsEnabled(res.data.signupsEnabled))
      .catch(() => { /* default true on failure */ });
  }, []);

  // On mount, restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(json => {
        setToken(stored);
        setUser(json.data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSessionWarning(null);
  }, []);

  // Force logout on any 401 from the API layer
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('mtl:unauthorized', handler);
    return () => window.removeEventListener('mtl:unauthorized', handler);
  }, [logout]);

  // Track user activity to decide between silent refresh and warning modal.
  // Also stamps the mount time so a user loading the page is considered active.
  useEffect(() => {
    lastActivityAt.current = Date.now();
    const update = () => { lastActivityAt.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, update, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, update));
  }, []);

  const keepAlive = useCallback(async () => {
    try {
      const { token: newToken } = await authApi.refresh();
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setSessionWarning(null);
    } catch {
      // Refresh failed — most likely the absolute session lifetime was exceeded.
      // Rather than a surprise silent logout, surface the warning modal with the
      // remaining countdown so the user can save their work. The existing expiry
      // timer will call logout() when the current token actually expires.
      const stored = localStorage.getItem(TOKEN_KEY);
      const expiresAt = stored ? parseTokenExpiry(stored) : null;
      if (expiresAt && expiresAt > Date.now()) {
        setSessionWarning({ expiresAt });
      } else {
        logout();
      }
    }
  }, [logout]);

  // Session expiry timers — reset whenever the token changes (including after refresh)
  useEffect(() => {
    if (!token) return;

    const expiresAt = parseTokenExpiry(token);
    if (!expiresAt) return;

    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 0) {
      // Defer so the state update happens outside the synchronous effect body.
      const t = setTimeout(logout, 0);
      return () => clearTimeout(t);
    }

    const handleWarnWindow = () => {
      const idleFor = Date.now() - lastActivityAt.current;
      if (idleFor < ACTIVE_WITHIN_MS) {
        // User was recently active — refresh silently without showing the modal
        keepAlive().catch(() => {});
      } else {
        setSessionWarning({ expiresAt });
      }
    };

    const timeUntilWarn = expiresAt - WARN_BEFORE_EXPIRY_MS - now;
    const warnTimer =
      timeUntilWarn > 0
        ? setTimeout(handleWarnWindow, timeUntilWarn)
        : setTimeout(handleWarnWindow, 0); // already in the warning window

    const expiryTimer = setTimeout(() => logout(), timeUntilExpiry);

    return () => {
      clearTimeout(warnTimer);
      clearTimeout(expiryTimer);
    };
  }, [token, logout, keepAlive]);

  const login = useCallback(
    async (email: string, password: string, onSolving?: () => void) => {
      const { token, user } = await authRequest('/auth/login', { email, password }, onSolving);
      localStorage.setItem(TOKEN_KEY, token);
      setToken(token);
      setUser(user);
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, onSolving?: () => void) => {
      const { token, user } = await authRequest(
        '/auth/register',
        { email, password },
        onSolving
      );
      localStorage.setItem(TOKEN_KEY, token);
      setToken(token);
      setUser(user);
    },
    []
  );

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    });
    if (res.ok) {
      const json = await res.json();
      setUser(json.data);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, sessionWarning, signupsEnabled, login, register, refreshUser, keepAlive, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
