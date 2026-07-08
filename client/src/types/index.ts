// API Response types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
}

// Entity types
export interface Account {
  id: string;
  name: string;
  baseCurrency: string;
  isDefault: boolean;
  isDemo: boolean;
  createdAt: string;
  archivedAt: string | null;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  timestamp: string;
  entryType: EntryType;
  symbol: string;
  quantity: string;
  price: string;
  fee: string | null;
  valueBase: string;
  pnl: string | null;
  netPnl: string | null;
  pnlStatus: string | null;
  notes: string | null;
  createdAt: string;
  account: Account;
}

export interface LedgerMetadata {
  id: string;
  ledgerEntryId: string;
  key: string;
  value: string;
}

export interface AccountPnL {
  accountId: string;
  baseCurrency: string;
  totalPnL: string;
  totalNetPnL: string;
  totalFees: string;
  uncomputableCount: number;
}

export interface AccountBalance {
  symbol: string;
  quantity: string;
  costBasis: string;
}

// Enums
export type EntryType = 'BUY' | 'SELL';

// Request types
export interface CreateAccountRequest {
  name: string;
  baseCurrency?: string;
}

export interface CreateLedgerEntryRequest {
  symbol: string;
  entryType: EntryType;
  quantity: string;
  price: string;
  fee?: string;
  timestamp?: string;
  notes?: string;
  accountId?: string;
}

export interface PersonalAccessToken {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  lastFourChars: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface CreateTokenResponse extends PersonalAccessToken {
  token: string;
}

// Query params
export interface LedgerQueryParams {
  accountId?: string;
  symbol?: string;
  entryType?: EntryType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}