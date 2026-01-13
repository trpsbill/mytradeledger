import { EntryType } from '@prisma/client';

// Request types for creating/updating entities

export interface CreateAccountRequest {
  name: string;
  baseCurrency?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  baseCurrency?: string;
  archivedAt?: Date | null;
}

export interface CreateAssetRequest {
  symbol: string;
  name?: string;
  precision?: number;
}

export interface UpdateAssetRequest {
  name?: string;
  precision?: number;
}

export interface CreateLedgerEntryRequest {
  symbol: string;
  entryType: EntryType;
  quantity: string | number;
  price: string | number;
  fee?: string | number | null;
  timestamp?: Date | string; // Defaults to now
  notes?: string | null;
}

export interface UpdateLedgerEntryRequest {
  symbol?: string;
  entryType?: EntryType;
  quantity?: string | number;
  price?: string | number;
  fee?: string | number | null;
  timestamp?: Date | string;
  notes?: string | null;
}

// Query parameters
export interface LedgerQueryParams {
  symbol?: string;
  entryType?: EntryType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  error: string;
  details?: string;
}
