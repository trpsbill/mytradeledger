// Unit tests for demoService.seedDemoAccount.
// Prisma and ledgerService are mocked; no database is touched.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAccountFindFirst = vi.hoisted(() => vi.fn());
const mockAccountCreate = vi.hoisted(() => vi.fn());
const mockLedgerEntryCreateMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockRecomputeSymbolPnl = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../db', () => ({
  default: {
    account: { findFirst: mockAccountFindFirst, create: mockAccountCreate },
    ledgerEntry: { createMany: mockLedgerEntryCreateMany },
    $transaction: mockTransaction,
  },
}));

vi.mock('./ledgerService', () => ({
  ledgerService: { recomputeSymbolPnl: mockRecomputeSymbolPnl },
}));

import { demoService } from './demoService';

beforeEach(() => {
  mockAccountFindFirst.mockReset().mockResolvedValue(null);
  mockAccountCreate.mockReset();
  mockLedgerEntryCreateMany.mockReset().mockResolvedValue({ count: 5 });
  mockTransaction.mockReset().mockImplementation((cb: (tx: unknown) => Promise<void>) => cb({}));
  mockRecomputeSymbolPnl.mockClear();
});

describe('demoService.seedDemoAccount', () => {
  it('creates a demo account with seeded ledger entries for a new user', async () => {
    mockAccountCreate.mockResolvedValue({ id: 'demo-account-1', userId: 'user-1', isDemo: true });

    const account = await demoService.seedDemoAccount('user-1');

    expect(account.id).toBe('demo-account-1');
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', isDemo: true, name: 'Demo Portfolio' }),
      })
    );
    expect(mockLedgerEntryCreateMany).toHaveBeenCalledOnce();
    expect(mockRecomputeSymbolPnl).toHaveBeenCalled();
  });

  it('returns the existing demo account instead of creating a duplicate', async () => {
    mockAccountFindFirst.mockResolvedValue({ id: 'existing-demo-account', userId: 'user-1', isDemo: true });

    const account = await demoService.seedDemoAccount('user-1');

    expect(account.id).toBe('existing-demo-account');
    expect(mockAccountCreate).not.toHaveBeenCalled();
  });
});
