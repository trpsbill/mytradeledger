// Unit tests for demoService.createDemoUser / cleanupExpiredDemoUsers.
// Prisma and ledgerService are mocked; no database is touched.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserCreate = vi.hoisted(() => vi.fn());
const mockUserDeleteMany = vi.hoisted(() => vi.fn());
const mockAccountFindFirst = vi.hoisted(() => vi.fn());
const mockAccountCreate = vi.hoisted(() => vi.fn());
const mockLedgerEntryCreateMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockRecomputeSymbolPnl = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../db', () => ({
  default: {
    user: { create: mockUserCreate, deleteMany: mockUserDeleteMany },
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
  mockUserCreate.mockReset();
  mockUserDeleteMany.mockReset();
  mockAccountFindFirst.mockReset().mockResolvedValue(null);
  mockAccountCreate.mockReset();
  mockLedgerEntryCreateMany.mockReset().mockResolvedValue({ count: 5 });
  mockTransaction.mockReset().mockImplementation((cb: (tx: unknown) => Promise<void>) => cb({}));
  mockRecomputeSymbolPnl.mockClear();
});

describe('demoService.createDemoUser', () => {
  it('creates an isolated, pre-verified demo user with a future expiry and seeds a demo account', async () => {
    mockUserCreate.mockResolvedValue({
      id: 'demo-user-1',
      email: 'demo-abc123@demo.mytradeledger.local',
      isPaid: false,
      isDemo: true,
    });
    mockAccountCreate.mockResolvedValue({ id: 'demo-account-1', userId: 'demo-user-1', isDemo: true });

    const user = await demoService.createDemoUser();

    expect(user.id).toBe('demo-user-1');
    expect(mockUserCreate).toHaveBeenCalledOnce();

    const createArgs = mockUserCreate.mock.calls[0][0].data;
    expect(createArgs.isDemo).toBe(true);
    expect(createArgs.email).toMatch(/^demo-.+@demo\.mytradeledger\.local$/);
    expect(createArgs.emailVerifiedAt).toBeInstanceOf(Date);
    expect(createArgs.demoExpiresAt).toBeInstanceOf(Date);
    expect(createArgs.demoExpiresAt.getTime()).toBeGreaterThan(Date.now());

    // seedDemoAccount was invoked for the new user
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'demo-user-1', isDemo: true }) })
    );
  });
});

describe('demoService.cleanupExpiredDemoUsers', () => {
  it('deletes only demo users whose expiry has passed', async () => {
    mockUserDeleteMany.mockResolvedValue({ count: 3 });

    const result = await demoService.cleanupExpiredDemoUsers();

    expect(result).toEqual({ deletedDemoUsers: 3 });
    expect(mockUserDeleteMany).toHaveBeenCalledWith({
      where: { isDemo: true, demoExpiresAt: { lt: expect.any(Date) } },
    });
  });

  it('reports zero when nothing is expired', async () => {
    mockUserDeleteMany.mockResolvedValue({ count: 0 });

    const result = await demoService.cleanupExpiredDemoUsers();

    expect(result).toEqual({ deletedDemoUsers: 0 });
  });
});

describe('demoService.deleteDemoUser', () => {
  it('deletes the given user only if they are a demo user', async () => {
    mockUserDeleteMany.mockResolvedValue({ count: 1 });

    const result = await demoService.deleteDemoUser('demo-user-1');

    expect(result).toEqual({ deleted: true });
    expect(mockUserDeleteMany).toHaveBeenCalledWith({
      where: { id: 'demo-user-1', isDemo: true },
    });
  });

  it('reports deleted: false as a no-op for a real (non-demo) user id', async () => {
    mockUserDeleteMany.mockResolvedValue({ count: 0 });

    const result = await demoService.deleteDemoUser('real-user-1');

    expect(result).toEqual({ deleted: false });
  });
});
