// Unit tests for the free-tier import cap applied by previewHandler and commitHandler.
// Prisma, dedupeCheck, and ledgerService are mocked — no database needed.

import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockAccountFindFirst = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'acc-1', name: 'Test Account' }),
);
const mockLedgerCreate = vi.hoisted(() => vi.fn().mockReturnValue(undefined));
const mockLedgerCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockUserUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockTransaction = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../db', () => ({
  default: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    account: { findFirst: mockAccountFindFirst, create: mockAccountFindFirst },
    ledgerEntry: { create: mockLedgerCreate, count: mockLedgerCount },
    $transaction: mockTransaction,
  },
}));

vi.mock('./dedupeCheck', () => ({
  checkDupes: vi.fn().mockResolvedValue({ duplicateIndices: new Set() }),
}));

vi.mock('../services/ledgerService', () => ({
  ledgerService: { recalculateAllPnL: vi.fn().mockResolvedValue(undefined) },
}));

import { previewHandler } from './preview';
import { commitHandler } from './commit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates N coinbase_retail-format BUY rows (one trade each). */
function makeCoinbaseCsv(count: number): string {
  const lines = [
    'You can use this transaction report to inform your likely tax obligations.',
    'Transactions',
    'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes,Sender Address,Recipient Address',
  ];
  for (let i = 0; i < count; i++) {
    const day = String(i + 1).padStart(2, '0');
    lines.push(`row${i},2024-01-${day} 12:00:00 UTC,Buy,BTC,0.01,USD,$50000.00,$500.00,$500.00,$0.00,,,`);
  }
  return lines.join('\n') + '\n';
}

const upload = multer({ storage: multer.memoryStorage() });

function makePreviewApp() {
  const app = express();
  app.use((_req, _res, next) => {
    (_req as express.Request & { user: { userId: string; email: string; isPaid: boolean } }).user = {
      userId: 'user-1',
      email: 'test@example.com',
      isPaid: false,
    };
    next();
  });
  app.post('/preview', upload.fields([{ name: 'file', maxCount: 1 }]), previewHandler);
  return app;
}

function makeCommitApp() {
  const app = express();
  app.use((_req, _res, next) => {
    (_req as express.Request & { user: { userId: string; email: string; isPaid: boolean } }).user = {
      userId: 'user-1',
      email: 'test@example.com',
      isPaid: false,
    };
    next();
  });
  app.post('/commit', upload.fields([{ name: 'file', maxCount: 1 }]), commitHandler);
  return app;
}

function fakeDbUser(isPaid: boolean, hasHitFreeLimit: boolean, entryCount: number) {
  return {
    isPaid,
    hasHitFreeLimit,
    accounts: [{ _count: { ledgerEntries: entryCount } }],
  };
}

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockTransaction.mockClear();
  mockLedgerCount.mockResolvedValue(0);
});

// ─── previewHandler cap tests ─────────────────────────────────────────────────

describe('previewHandler — free-tier import cap', () => {
  it('caps willImport to min(FREE_IMPORT_CAP=10, slotsLeft) when user has existing entries', async () => {
    // 20 existing entries → slotsLeft = 5, cap = min(10, 5) = 5
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, false, 20));

    const res = await request(makePreviewApp())
      .post('/preview')
      .field('presetId', 'coinbase_retail')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.summary.freeImportCap).toBe(5);
    expect(res.body.summary.willImportCount).toBe(5);
    expect(res.body.summary.cappedCount).toBe(10); // 15 - 5
  });

  it('caps willImport to FREE_IMPORT_CAP=10 when user has plenty of slots remaining', async () => {
    // 0 existing entries → slotsLeft = 25, cap = min(10, 25) = 10
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, false, 0));

    const res = await request(makePreviewApp())
      .post('/preview')
      .field('presetId', 'coinbase_retail')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.summary.freeImportCap).toBe(10);
    expect(res.body.summary.willImportCount).toBe(10);
    expect(res.body.summary.cappedCount).toBe(5); // 15 - 10
  });

  it('caps willImport to 0 when hasHitFreeLimit is true (anti-bypass)', async () => {
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, true, 5));

    const res = await request(makePreviewApp())
      .post('/preview')
      .field('presetId', 'coinbase_retail')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.summary.freeImportCap).toBe(0);
    expect(res.body.summary.willImportCount).toBe(0);
  });

  it('does not apply a cap for paid users (freeImportCap is null)', async () => {
    mockUserFindUnique.mockResolvedValue(fakeDbUser(true, false, 100));

    const res = await request(makePreviewApp())
      .post('/preview')
      .field('presetId', 'coinbase_retail')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.summary.freeImportCap).toBeNull();
    expect(res.body.summary.willImportCount).toBe(15);
  });
});

// ─── commitHandler cap tests ──────────────────────────────────────────────────

describe('commitHandler — free-tier batch cap', () => {
  it('commits only min(FREE_IMPORT_CAP=10, slotsLeft) trades when user is near the limit', async () => {
    // 20 existing → slotsLeft = 5, cap = min(10, 5) = 5; CSV has 15 rows
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, false, 20));

    const res = await request(makeCommitApp())
      .post('/commit')
      .field('presetId', 'coinbase_retail')
      .field('accountName', 'Test Account')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.importedCount).toBe(5);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(5);
  });

  it('commits up to FREE_IMPORT_CAP=10 when user has ample slots remaining', async () => {
    // 0 existing → slotsLeft = 25, cap = min(10, 25) = 10; CSV has 15 rows
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, false, 0));

    const res = await request(makeCommitApp())
      .post('/commit')
      .field('presetId', 'coinbase_retail')
      .field('accountName', 'Test Account')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.importedCount).toBe(10);
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(10);
  });

  it('commits zero trades when user has hit the free limit', async () => {
    // slotsLeft = max(0, 25 - 25) = 0; importCap = min(10, 0) = 0
    mockUserFindUnique.mockResolvedValue(fakeDbUser(false, false, 25));

    const res = await request(makeCommitApp())
      .post('/commit')
      .field('presetId', 'coinbase_retail')
      .field('accountName', 'Test Account')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.importedCount).toBe(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not cap for paid users (all trades committed)', async () => {
    mockUserFindUnique.mockResolvedValue(fakeDbUser(true, false, 100));

    const res = await request(makeCommitApp())
      .post('/commit')
      .field('presetId', 'coinbase_retail')
      .field('accountName', 'Test Account')
      .attach('file', Buffer.from(makeCoinbaseCsv(15)), 'trades.csv');

    expect(res.status).toBe(200);
    expect(res.body.importedCount).toBe(15);
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(15);
  });
});
