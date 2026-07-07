import type {
  ApiResponse,
  Account,
  LedgerEntry,
  AccountBalance,
  AccountPnL,
  CreateAccountRequest,
  CreateLedgerEntryRequest,
  LedgerQueryParams,
  PersonalAccessToken,
  CreateTokenResponse,
} from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'mtl_token';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('mtl:unauthorized'));
    }
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API (public — no token required)
export const authApi = {
  getConfig: () => request<{ data: { signupsEnabled: boolean } }>('/auth/config'),

  refresh: async (): Promise<{ token: string }> => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) throw new Error('No session token');
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stored}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Refresh failed' }));
      throw new Error(error.error || 'Refresh failed');
    }
    const json = await response.json();
    return json.data as { token: string };
  },

};

// Accounts API
export const accountsApi = {
  list: (includeArchived = false) =>
    request<ApiResponse<Account[]>>(`/accounts?includeArchived=${includeArchived}`),

  get: (id: string) => request<ApiResponse<Account>>(`/accounts/${id}`),

  getBalance: (id: string) =>
    request<ApiResponse<AccountBalance[]>>(`/accounts/${id}/balance`),

  getPnL: (id: string) =>
    request<ApiResponse<AccountPnL>>(`/accounts/${id}/pnl`),

  create: (data: CreateAccountRequest) =>
    request<ApiResponse<Account>>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateAccountRequest>) =>
    request<ApiResponse<Account>>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setDefault: (id: string) =>
    request<ApiResponse<Account>>(`/accounts/${id}/set-default`, { method: 'POST' }),

  archive: (id: string) =>
    request<ApiResponse<Account>>(`/accounts/${id}/archive`, { method: 'POST' }),

  unarchive: (id: string) =>
    request<ApiResponse<Account>>(`/accounts/${id}/unarchive`, { method: 'POST' }),

  delete: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),

  seedDemo: () =>
    request<ApiResponse<Account>>('/accounts/demo', { method: 'POST' }),
};

// Ledger API
export const ledgerApi = {
  list: (params: LedgerQueryParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    const query = searchParams.toString();
    return request<ApiResponse<LedgerEntry[]>>(`/ledger${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<ApiResponse<LedgerEntry>>(`/ledger/${id}`),

  create: (data: CreateLedgerEntryRequest) =>
    request<ApiResponse<LedgerEntry>>('/ledger', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateLedgerEntryRequest>) =>
    request<ApiResponse<LedgerEntry>>(`/ledger/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/ledger/${id}`, { method: 'DELETE' }),

  deleteBatch: (ids: string[]) =>
    request<{ data: { deleted: number } }>('/ledger/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),

  exportCsv: async () => {
    const response = await fetch(`${API_BASE}/ledger/export/csv`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clearAll: () =>
    request<ApiResponse<{ deleted: number }>>('/ledger/all', { method: 'DELETE' }),
};

// Personal Access Tokens API
export const tokensApi = {
  list: () => request<ApiResponse<PersonalAccessToken[]>>('/auth/tokens'),

  create: (data: { name: string; expiresAt?: string }) =>
    request<ApiResponse<CreateTokenResponse>>('/auth/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revoke: (id: string) => request<void>(`/auth/tokens/${id}`, { method: 'DELETE' }),
};

// Support API
export const supportApi = {
  submit: (data: { subject: string; message: string }) =>
    request<void>('/support', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
