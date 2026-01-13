import type {
  ApiResponse,
  Account,
  LedgerEntry,
  AccountBalance,
  AccountPnL,
  CreateAccountRequest,
  CreateLedgerEntryRequest,
  LedgerQueryParams,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

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

  archive: (id: string) =>
    request<ApiResponse<Account>>(`/accounts/${id}/archive`, { method: 'POST' }),

  unarchive: (id: string) =>
    request<ApiResponse<Account>>(`/accounts/${id}/unarchive`, { method: 'POST' }),

  delete: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),
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
};
