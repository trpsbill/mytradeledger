// Integration tests for the DB-touching P&L service layer.
// These tests run against a real ephemeral PostgreSQL container
// (provisioned by integration-setup.ts) and assert on stored rows,
// proving what pure unit tests cannot: that the Prisma WHERE clauses,
// aggregates, and write paths are correct end-to-end.
//
// ISOLATION: beforeEach truncates all tables so each test starts from empty.
// TIMESTAMPS: all dates are explicit constants — no Date.now().
// ASSERTIONS: all monetary comparisons use Prisma.Decimal.equals(), not JS float.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { ledgerService } from '../services/ledgerService';
import { accountService } from '../services/accountService';

const D = (v: string | number) => new Prisma.Decimal(v.toString());

// ─── Fixed timestamps (no Date.now()) ────────────────────────────────────────

// BTX pinned dataset timestamps
const BTX_T_BUY  = new Date('2024-01-01T01:02:00.000Z');
const BTX_T_SELL1 = new Date('2024-01-01T01:07:00.000Z');
const BTX_T_SELL2 = new Date('2024-01-01T01:09:00.000Z');

// asOf filter test timestamps
const T_BEFORE = new Date('2024-06-01T10:00:00.000Z');
const T_SELL   = new Date('2024-06-01T11:00:00.000Z');
const T_AFTER  = new Date('2024-06-01T12:00:00.000Z');

// ─── Per-test state ───────────────────────────────────────────────────────────

let userId: string;
let accountId: string;

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Truncate in FK-safe order
  await prisma.ledgerMetadata.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.personalAccessToken.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: 'integration@test.local', passwordHash: 'not-a-real-hash' },
  });
  userId = user.id;

  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Integration Account', baseCurrency: 'USD', isDefault: true },
  });
  accountId = account.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedBTXDataset() {
  // Pinned BTX dataset:
  //   BUY   qty=+2  price=22000  fee=450   valueBase=−44000
  //   SELL1 qty=−1  price=22350  fee=200   valueBase=+22350
  //   SELL2 qty=−1  price=22000  fee=0     valueBase=+22000
  await prisma.ledgerEntry.createMany({
    data: [
      {
        accountId,
        timestamp: BTX_T_BUY,
        entryType: 'BUY',
        symbol: 'BTX',
        quantity: D('2'),
        price: D('22000'),
        fee: D('450'),
        valueBase: D('-44000'),
      },
      {
        accountId,
        timestamp: BTX_T_SELL1,
        entryType: 'SELL',
        symbol: 'BTX',
        quantity: D('-1'),
        price: D('22350'),
        fee: D('200'),
        valueBase: D('22350'),
      },
      {
        accountId,
        timestamp: BTX_T_SELL2,
        entryType: 'SELL',
        symbol: 'BTX',
        quantity: D('-1'),
        price: D('22000'),
        fee: D('0'),
        valueBase: D('22000'),
      },
    ],
  });
}

// ─── getAverageCost — asOf filter ────────────────────────────────────────────

describe('getAverageCost — asOf SQL filter', () => {
  // Scenario for all tests in this block:
  //   T_BEFORE: BUY 10 @ 100  ← should always be included
  //   T_SELL:   (the sell timestamp used as asOf boundary)
  //   T_AFTER:  BUY 10 @ 200  ← must be excluded when asOf=T_SELL

  beforeEach(async () => {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          accountId,
          timestamp: T_BEFORE,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('100'),
          valueBase: D('-1000'),
        },
        {
          accountId,
          timestamp: T_AFTER,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('200'),
          valueBase: D('-2000'),
        },
      ],
    });
  });

  it('with asOf=T_SELL: includes only the T_BEFORE buy, returns avg=100', async () => {
    // Only T_BEFORE (10@100) passes WHERE timestamp <= T_SELL.
    // T_AFTER buy (10@200) is excluded.
    // avg = (10×100)/10 = 100
    const avg = await ledgerService.getAverageCost(accountId, 'XYZ', T_SELL);
    expect(avg).not.toBeNull();
    expect(avg!.equals(D('100'))).toBe(true);
  });

  it('without asOf: includes all buys, returns contaminated avg=150', async () => {
    // avg = (10×100 + 10×200)/20 = 3000/20 = 150
    const avg = await ledgerService.getAverageCost(accountId, 'XYZ');
    expect(avg).not.toBeNull();
    expect(avg!.equals(D('150'))).toBe(true);
  });

  it('boundary — buy at exactly asOf timestamp is included (lte semantics)', async () => {
    // Insert a third buy AT the exact sell timestamp.
    // lte: T_SELL means timestamp <= T_SELL, so this buy IS included.
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: T_SELL,
        entryType: 'BUY',
        symbol: 'XYZ',
        quantity: D('10'),
        price: D('150'),
        valueBase: D('-1500'),
      },
    });
    // Buys included: T_BEFORE(10@100) + T_SELL(10@150) = 20 qty, cost=2500
    // avg = 2500/20 = 125
    const avg = await ledgerService.getAverageCost(accountId, 'XYZ', T_SELL);
    expect(avg).not.toBeNull();
    expect(avg!.equals(D('125'))).toBe(true);
  });

  it('same timestamp as sell — buy is included in cost basis (lte)', async () => {
    // A BUY and SELL recorded at the identical millisecond.
    // With lte semantics the buy is included, which is the correct economic reading:
    // the buy settled before or at the same moment as the sell.
    const sharedTime = new Date('2024-06-01T11:00:00.000Z'); // same as T_SELL
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: sharedTime,
        entryType: 'BUY',
        symbol: 'XYZ',
        quantity: D('10'),
        price: D('150'),
        valueBase: D('-1500'),
      },
    });
    // Buys at or before sharedTime: T_BEFORE(10@100) + sharedTime(10@150)
    // avg = (1000+1500)/20 = 2500/20 = 125
    const avg = await ledgerService.getAverageCost(accountId, 'XYZ', sharedTime);
    expect(avg!.equals(D('125'))).toBe(true);
  });
});

// ─── getNetAverageCost — asOf SQL filter ─────────────────────────────────────

describe('getNetAverageCost — asOf SQL filter', () => {
  beforeEach(async () => {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          accountId,
          timestamp: T_BEFORE,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('100'),
          fee: D('50'),        // fee folded into net basis
          valueBase: D('-1000'),
        },
        {
          accountId,
          timestamp: T_AFTER,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('200'),
          fee: D('100'),
          valueBase: D('-2000'),
        },
      ],
    });
  });

  it('with asOf=T_SELL: net avg uses only T_BEFORE buy (fee folded in)', async () => {
    // net_avg = (10×100 + 50)/10 = 1050/10 = 105
    const netAvg = await ledgerService.getNetAverageCost(accountId, 'XYZ', T_SELL);
    expect(netAvg).not.toBeNull();
    expect(netAvg!.equals(D('105'))).toBe(true);
  });

  it('without asOf: net avg includes both buys', async () => {
    // net_avg = (10×100+50 + 10×200+100)/20 = (1050+2100)/20 = 3150/20 = 157.5
    const netAvg = await ledgerService.getNetAverageCost(accountId, 'XYZ');
    expect(netAvg).not.toBeNull();
    expect(netAvg!.equals(D('157.5'))).toBe(true);
  });

  it('boundary — buy at exactly asOf is included in net avg', async () => {
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: T_SELL,
        entryType: 'BUY',
        symbol: 'XYZ',
        quantity: D('10'),
        price: D('150'),
        fee: D('0'),
        valueBase: D('-1500'),
      },
    });
    // net_avg = (10×100+50 + 10×150+0)/20 = (1050+1500)/20 = 2550/20 = 127.5
    const netAvg = await ledgerService.getNetAverageCost(accountId, 'XYZ', T_SELL);
    expect(netAvg!.equals(D('127.5'))).toBe(true);
  });
});

// ─── recalculateAllPnL — BTX pinned dataset ───────────────────────────────────

describe('recalculateAllPnL — BTX pinned dataset end-to-end', () => {
  // Arithmetic (auditable):
  //
  // GROSS avg_cost = (2×22000)/2 = 22000
  //   sell1 gross = (22350−22000)×1 = +350
  //   sell2 gross = (22000−22000)×1 =    0
  //
  // NET avg_cost  = (2×22000+450)/2 = 44450/2 = 22225
  //   sell1 net   = (22350×1−200) − (22225×1) = 22150−22225 = −75
  //   sell2 net   = (22000×1−0)   − (22225×1) = 22000−22225 = −225

  it('stores correct gross pnl and net_pnl for both SELL rows', async () => {
    await seedBTXDataset();

    const { updated } = await ledgerService.recalculateAllPnL(userId);
    expect(updated).toBe(2);

    const sells = await prisma.ledgerEntry.findMany({
      where: { accountId, entryType: 'SELL', symbol: 'BTX' },
      orderBy: { timestamp: 'asc' },
    });
    expect(sells).toHaveLength(2);

    const [sell1, sell2] = sells;

    // sell1 — price 22350, fee 200
    expect(sell1.pnl).not.toBeNull();
    expect(sell1.pnl!.equals(D('350'))).toBe(true);
    expect(sell1.netPnl).not.toBeNull();
    expect(sell1.netPnl!.equals(D('-75'))).toBe(true);

    // sell2 — price 22000, fee 0
    expect(sell2.pnl).not.toBeNull();
    expect(sell2.pnl!.isZero()).toBe(true);
    expect(sell2.netPnl).not.toBeNull();
    expect(sell2.netPnl!.equals(D('-225'))).toBe(true);
  });

  it('BUY rows are unchanged (pnl stays null)', async () => {
    await seedBTXDataset();
    await ledgerService.recalculateAllPnL(userId);

    const buy = await prisma.ledgerEntry.findFirstOrThrow({
      where: { accountId, entryType: 'BUY', symbol: 'BTX' },
    });
    expect(buy.pnl).toBeNull();
    expect(buy.netPnl).toBeNull();
  });
});

// ─── asOf contamination regression — SQL level ───────────────────────────────

describe('asOf contamination regression — future buy must not contaminate past sell', () => {
  // Scenario:
  //   T_BEFORE  BUY  10 @ 100  (before the sell)
  //   T_SELL    SELL  5 @ 120  (the sell being costed)
  //   T_AFTER   BUY  10 @ 200  (AFTER the sell — must NOT affect the sell's P&L)
  //
  // CORRECT (asOf=T_SELL):
  //   gross avg = (10×100)/10 = 100
  //   gross pnl = (120−100)×5 = +100
  //   net avg   = (10×100+0)/10 = 100   (no fee on buy)
  //   net pnl   = (120×5−0) − (100×5) = 600−500 = +100
  //
  // PRE-FIX BUG (no asOf, all buys included):
  //   avg = (10×100+10×200)/20 = 150
  //   pnl = (120−150)×5 = −150   ← WRONG

  it('recalculateAllPnL: sell pnl is NOT contaminated by the later buy', async () => {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          accountId,
          timestamp: T_BEFORE,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('100'),
          fee: null,
          valueBase: D('-1000'),
        },
        {
          accountId,
          timestamp: T_SELL,
          entryType: 'SELL',
          symbol: 'XYZ',
          quantity: D('-5'),
          price: D('120'),
          fee: null,
          valueBase: D('600'),
        },
        {
          accountId,
          timestamp: T_AFTER,
          entryType: 'BUY',
          symbol: 'XYZ',
          quantity: D('10'),
          price: D('200'),   // high price — would pull avg up to 150 if included
          fee: null,
          valueBase: D('-2000'),
        },
      ],
    });

    await ledgerService.recalculateAllPnL(userId);

    const sell = await prisma.ledgerEntry.findFirstOrThrow({
      where: { accountId, entryType: 'SELL', symbol: 'XYZ' },
    });

    // Correct result — only the T_BEFORE buy used
    expect(sell.pnl!.equals(D('100'))).toBe(true);
    expect(sell.netPnl!.equals(D('100'))).toBe(true);

    // Pre-fix bug would have produced pnl=−150.
    // Verified by the unit-test in pnlCalculations.test.ts "bug (no asOf)" block.
    expect(sell.pnl!.equals(D('-150'))).toBe(false);
  });
});

// ─── accountService.getPnL aggregate ─────────────────────────────────────────

describe('accountService.getPnL — aggregate correctness', () => {
  // BTX pinned dataset aggregate arithmetic. For a fully-closed position the
  // per-SELL realized P&L (avg-cost method, what getPnL sums) collapses to the
  // raw cash-flow identity below:
  //   SUM(valueBase) = −44000 + 22350 + 22000 = +350   (gross)
  //   SUM(fee)       =    450 +   200 +     0 =  650   (commission drag)
  //   totalNetPnL    = 350 − 650               = −300
  //
  // getPnL aggregates the stored pnl/netPnl columns (the correct way to measure
  // *realized* P&L — SUM(valueBase) would mis-report an open position). Those
  // columns are populated by the write path / recalculate, so seed + recalc
  // here to reproduce the production state before aggregating.

  beforeEach(async () => {
    await seedBTXDataset();
    await ledgerService.recalculateAllPnL(userId);
  });

  it('totalPnL (gross) = +350', async () => {
    const result = await accountService.getPnL(accountId, userId);
    expect(result).not.toBeNull();
    expect(result!.totalPnL.equals(D('350'))).toBe(true);
  });

  it('totalFees (commission drag) = 650', async () => {
    const result = await accountService.getPnL(accountId, userId);
    expect(result!.totalFees.equals(D('650'))).toBe(true);
  });

  it('totalNetPnL = −300 (gross − fees)', async () => {
    const result = await accountService.getPnL(accountId, userId);
    expect(result!.totalNetPnL.equals(D('-300'))).toBe(true);
  });

  it('reconciliation: SUM(valueBase) − SUM(fee) = totalNetPnL = −300', async () => {
    // Independent DB aggregate to confirm the service result matches raw SQL math.
    const agg = await prisma.ledgerEntry.aggregate({
      where: { accountId },
      _sum: { valueBase: true, fee: true },
    });
    const sumVB = agg._sum.valueBase!;
    const sumFee = agg._sum.fee!;
    const reconciled = sumVB.sub(sumFee);

    const result = await accountService.getPnL(accountId, userId);
    expect(reconciled.equals(result!.totalNetPnL)).toBe(true);
    expect(reconciled.equals(D('-300'))).toBe(true);
  });

  it('returns null for an account that does not belong to the user', async () => {
    const result = await accountService.getPnL(accountId, 'non-existent-user-id');
    expect(result).toBeNull();
  });
});

// ─── NULL net_pnl handling ────────────────────────────────────────────────────

describe('NULL net_pnl handling — post-migration / pre-backfill window', () => {
  // After ALTER TABLE adds net_pnl but before recalculate-pnl runs, existing
  // SELL rows will have pnl/net_pnl = NULL. getPnL sums the stored pnl/net_pnl
  // columns (the correct measure of *realized* P&L), so NULL rows simply do not
  // contribute until a recalculate backfills them — consistent with the app's
  // "P&L honesty" design (uncomputed rows are flagged, never guessed from raw
  // cash flow). The contract under test: NULL columns are tolerated safely —
  // no NaN, no throw — and fees (always present) still aggregate correctly.

  it('getPnL tolerates NULL pnl/net_pnl on SELL rows without NaN or throw', async () => {
    // Seed a BUY and a SELL directly, leaving pnl/netPnl = NULL on both
    await prisma.ledgerEntry.createMany({
      data: [
        {
          accountId,
          timestamp: BTX_T_BUY,
          entryType: 'BUY',
          symbol: 'ABC',
          quantity: D('1'),
          price: D('500'),
          fee: D('10'),
          valueBase: D('-500'),
          // pnl/netPnl omitted → NULL
        },
        {
          accountId,
          timestamp: BTX_T_SELL1,
          entryType: 'SELL',
          symbol: 'ABC',
          quantity: D('-1'),
          price: D('600'),
          fee: D('5'),
          valueBase: D('600'),
          // pnl/netPnl omitted → NULL (simulates pre-backfill state)
        },
      ],
    });

    // Confirm netPnl is actually NULL in DB
    const sell = await prisma.ledgerEntry.findFirstOrThrow({
      where: { accountId, entryType: 'SELL' },
    });
    expect(sell.netPnl).toBeNull();

    const result = await accountService.getPnL(accountId, userId);
    expect(result).not.toBeNull();

    // Uncomputed (NULL) rows contribute 0 to the realized-P&L totals — the safe,
    // honest default. Fees (never NULL here) still sum: 10 + 5 = 15.
    expect(result!.totalPnL.equals(D('0'))).toBe(true);
    expect(result!.totalNetPnL.equals(D('0'))).toBe(true);
    expect(result!.totalFees.equals(D('15'))).toBe(true);

    // Sanity: no NaN anywhere
    expect(Number.isNaN(result!.totalPnL.toNumber())).toBe(false);
    expect(Number.isNaN(result!.totalNetPnL.toNumber())).toBe(false);
    expect(Number.isNaN(result!.totalFees.toNumber())).toBe(false);

    // And once recalculate backfills the columns, the totals become correct.
    await ledgerService.recalculateAllPnL(userId);
    const after = await accountService.getPnL(accountId, userId);
    // gross = (600 − 500) × 1 = +100; net = (600 − 5) − (500 + 10) = +85
    expect(after!.totalPnL.equals(D('100'))).toBe(true);
    expect(after!.totalNetPnL.equals(D('85'))).toBe(true);
  });

  it('recalculateAllPnL fills in net_pnl on previously-NULL rows', async () => {
    // Seed SELL with no pnl/netPnl (as it would exist post-migration, pre-backfill)
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: BTX_T_BUY,
        entryType: 'BUY',
        symbol: 'ABC',
        quantity: D('1'),
        price: D('500'),
        fee: D('10'),
        valueBase: D('-500'),
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: BTX_T_SELL1,
        entryType: 'SELL',
        symbol: 'ABC',
        quantity: D('-1'),
        price: D('600'),
        fee: D('5'),
        valueBase: D('600'),
        pnl: null,
        netPnl: null,
      },
    });

    await ledgerService.recalculateAllPnL(userId);

    const sell = await prisma.ledgerEntry.findFirstOrThrow({
      where: { accountId, entryType: 'SELL' },
    });

    // gross pnl = (600 − 500) × 1 = +100
    expect(sell.pnl!.equals(D('100'))).toBe(true);
    // net avg = (1×500+10)/1 = 510; net pnl = (600×1−5) − 510 = 595−510 = +85
    expect(sell.netPnl!.equals(D('85'))).toBe(true);
  });
});

// ─── accountService.setDefault ────────────────────────────────────────────────

describe('accountService.setDefault', () => {
  it('marks the target account as default and clears it from others', async () => {
    const second = await prisma.account.create({
      data: { userId, name: 'Second', baseCurrency: 'USD' },
    });

    // Confirm initial state: first account was created with isDefault = true by the
    // beforeEach migration (which backfilled it), second starts as false.
    const before = await prisma.account.findUnique({ where: { id: accountId } });
    expect(before!.isDefault).toBe(true);

    await accountService.setDefault(second.id, userId);

    const [first, sec] = await Promise.all([
      prisma.account.findUnique({ where: { id: accountId } }),
      prisma.account.findUnique({ where: { id: second.id } }),
    ]);
    expect(first!.isDefault).toBe(false);
    expect(sec!.isDefault).toBe(true);
  });

  it('is idempotent — setting an already-default account changes nothing', async () => {
    await accountService.setDefault(accountId, userId);
    const acc = await prisma.account.findUnique({ where: { id: accountId } });
    expect(acc!.isDefault).toBe(true);
  });

  it('returns null for an account that does not belong to the user', async () => {
    const result = await accountService.setDefault(accountId, 'wrong-user-id');
    expect(result).toBeNull();
  });
});

// ─── ledgerService.create — accountId selection ───────────────────────────────

describe('ledgerService.create — accountId selection', () => {
  it('saves to the specified account when accountId is provided', async () => {
    const second = await prisma.account.create({
      data: { userId, name: 'Second', baseCurrency: 'USD' },
    });

    const entry = await ledgerService.create(userId, {
      symbol: 'ETH',
      entryType: 'BUY',
      quantity: '1',
      price: '3000',
      accountId: second.id,
    });

    expect(entry.accountId).toBe(second.id);
  });

  it('falls back to the default account when accountId is omitted', async () => {
    const entry = await ledgerService.create(userId, {
      symbol: 'BTC',
      entryType: 'BUY',
      quantity: '1',
      price: '50000',
    });

    expect(entry.accountId).toBe(accountId);
  });

  it('uses the sole real account when accountId is omitted and user has exactly one account', async () => {
    const entry = await ledgerService.create(userId, {
      symbol: 'SOL',
      entryType: 'BUY',
      quantity: '5',
      price: '100',
    });

    expect(entry.accountId).toBe(accountId);
  });

  it('throws when accountId is omitted and user has multiple real accounts', async () => {
    await prisma.account.create({
      data: { userId, name: 'Second', baseCurrency: 'USD' },
    });

    await expect(
      ledgerService.create(userId, {
        symbol: 'ETH',
        entryType: 'BUY',
        quantity: '1',
        price: '3000',
      })
    ).rejects.toThrow('accountId is required when multiple accounts exist');
  });

  it('throws when the provided accountId belongs to a different user', async () => {
    const other = await prisma.user.create({
      data: { email: 'other@test.local', passwordHash: 'x' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: other.id, name: 'Other Account', baseCurrency: 'USD' },
    });

    await expect(
      ledgerService.create(userId, {
        symbol: 'BTC',
        entryType: 'BUY',
        quantity: '1',
        price: '50000',
        accountId: otherAccount.id,
      })
    ).rejects.toThrow('Account not found');
  });
});

// ─── ledgerService.update — cross-account move + P&L recompute ───────────────

describe('ledgerService.update — cross-account move', () => {
  const T1 = new Date('2024-03-01T10:00:00.000Z');
  const T2 = new Date('2024-03-01T11:00:00.000Z');

  it('moves an entry to a different account and recomputes P&L on both sides', async () => {
    const second = await prisma.account.create({
      data: { userId, name: 'Second', baseCurrency: 'USD' },
    });

    // Seed: BUY 1 ETH @2000 in account1, then SELL 1 ETH @2500 in account1.
    // After move: the BUY goes to second; account1 SELL loses its cost basis
    // (PNL_UNCOMPUTABLE); second gets the BUY (no SELLs, so nothing to recompute there).
    const buy = await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: T1,
        entryType: 'BUY',
        symbol: 'ETH',
        quantity: D('1'),
        price: D('2000'),
        valueBase: D('-2000'),
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: T2,
        entryType: 'SELL',
        symbol: 'ETH',
        quantity: D('-1'),
        price: D('2500'),
        valueBase: D('2500'),
        pnl: D('500'),
        netPnl: D('500'),
        pnlStatus: null,
      },
    });

    // Move the BUY to the second account
    await ledgerService.update(buy.id, userId, { accountId: second.id });

    // The SELL in account1 now has no BUY to cost against → PNL_UNCOMPUTABLE
    const sell = await prisma.ledgerEntry.findFirstOrThrow({
      where: { accountId, entryType: 'SELL', symbol: 'ETH' },
    });
    expect(sell.pnlStatus).toBe('PNL_UNCOMPUTABLE');

    // The moved BUY is now in the second account
    const movedBuy = await prisma.ledgerEntry.findUnique({ where: { id: buy.id } });
    expect(movedBuy!.accountId).toBe(second.id);
  });

  it('rejects a move to an account belonging to a different user', async () => {
    const other = await prisma.user.create({
      data: { email: 'other2@test.local', passwordHash: 'x' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: other.id, name: 'Other', baseCurrency: 'USD' },
    });

    const entry = await prisma.ledgerEntry.create({
      data: {
        accountId,
        timestamp: T1,
        entryType: 'BUY',
        symbol: 'SOL',
        quantity: D('10'),
        price: D('100'),
        valueBase: D('-1000'),
      },
    });

    await expect(
      ledgerService.update(entry.id, userId, { accountId: otherAccount.id })
    ).rejects.toThrow('Account not found');
  });
});

// ─── findAll — pagination contract ───────────────────────────────────────────

describe('findAll — pagination', () => {
  // Five entries with distinct timestamps and symbols so individual rows
  // can be identified without ambiguity.
  const PA_T1 = new Date('2024-07-01T09:00:00.000Z');
  const PA_T2 = new Date('2024-07-01T10:00:00.000Z');
  const PA_T3 = new Date('2024-07-01T11:00:00.000Z');
  const PA_T4 = new Date('2024-07-01T12:00:00.000Z');
  const PA_T5 = new Date('2024-07-01T13:00:00.000Z');

  beforeEach(async () => {
    await prisma.ledgerEntry.createMany({
      data: [PA_T1, PA_T2, PA_T3, PA_T4, PA_T5].map((ts, i) => ({
        accountId,
        timestamp: ts,
        entryType: 'BUY' as const,
        symbol: `PA${i + 1}`,
        quantity: D('1'),
        price: D('100'),
        valueBase: D('-100'),
      })),
    });
  });

  it('returns all entries and correct total when limit > count', async () => {
    const { entries, total, limit, offset } = await ledgerService.findAll({ userId, limit: 10, offset: 0 });
    expect(entries).toHaveLength(5);
    expect(total).toBe(5);
    expect(limit).toBe(10);
    expect(offset).toBe(0);
  });

  it('respects limit — returns at most N entries', async () => {
    const { entries, total } = await ledgerService.findAll({ userId, limit: 2, offset: 0 });
    expect(entries).toHaveLength(2);
    expect(total).toBe(5);  // total reflects unfiltered count, not the page size
  });

  it('respects offset — skips the first N entries', async () => {
    const { entries } = await ledgerService.findAll({ userId, limit: 10, offset: 3 });
    expect(entries).toHaveLength(2);
  });

  it('page 2 returns a non-overlapping slice with the same total', async () => {
    const page1 = await ledgerService.findAll({ userId, limit: 2, offset: 0 });
    const page2 = await ledgerService.findAll({ userId, limit: 2, offset: 2 });

    const ids1 = new Set(page1.entries.map((e) => e.id));
    const ids2 = page2.entries.map((e) => e.id);

    expect(ids2.some((id) => ids1.has(id))).toBe(false);
    expect(page1.total).toBe(page2.total);
    expect(page1.total).toBe(5);
  });

  it('returns empty entries and correct total when offset >= count', async () => {
    const { entries, total } = await ledgerService.findAll({ userId, limit: 10, offset: 10 });
    expect(entries).toHaveLength(0);
    expect(total).toBe(5);
  });

  it('entries are ordered newest-first (timestamp desc)', async () => {
    const { entries } = await ledgerService.findAll({ userId });
    const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });
});

// ─── close-and-reopen regression (issue #114) ─────────────────────────────────

describe('close-and-reopen regression — per-position avg cost (issue #114)', () => {
  // Scenario from issue #114:
  //   t1: BUY  10 @ 100  → open position, avg_cost = 100
  //   t2: SELL 10 @ 120  → position fully closed, pnl = +200
  //   t3: BUY   5 @ 200  → new position opens; avg_cost should reset to 200
  //   t4: SELL  5 @ 250  → pnl should = (250−200)×5 = +250
  //
  // Bug: old code fetched all buys with timestamp <= sell, blending closed lots
  // into the new position's cost basis:
  //   wrong avg = (10×100 + 5×200)/15 = 133.33 → pnl = +583.33 ❌

  const T1 = new Date('2024-05-01T09:00:00.000Z');
  const T2 = new Date('2024-05-01T10:00:00.000Z');
  const T3 = new Date('2024-05-01T11:00:00.000Z');
  const T4 = new Date('2024-05-01T12:00:00.000Z');

  it('recalculateAllPnL: closed lots do not contaminate the reopened position', async () => {
    await prisma.ledgerEntry.createMany({
      data: [
        { accountId, timestamp: T1, entryType: 'BUY',  symbol: 'XYZ', quantity: D('10'),  price: D('100'), valueBase: D('-1000') },
        { accountId, timestamp: T2, entryType: 'SELL', symbol: 'XYZ', quantity: D('-10'), price: D('120'), valueBase: D('1200') },
        { accountId, timestamp: T3, entryType: 'BUY',  symbol: 'XYZ', quantity: D('5'),   price: D('200'), valueBase: D('-1000') },
        { accountId, timestamp: T4, entryType: 'SELL', symbol: 'XYZ', quantity: D('-5'),  price: D('250'), valueBase: D('1250') },
      ],
    });

    await ledgerService.recalculateAllPnL(userId);

    const sells = await prisma.ledgerEntry.findMany({
      where: { accountId, entryType: 'SELL', symbol: 'XYZ' },
      orderBy: { timestamp: 'asc' },
    });
    expect(sells).toHaveLength(2);

    const [sell1, sell2] = sells;

    // First sell: BUY 10@100, SELL 10@120 → pnl = (120−100)×10 = +200
    expect(sell1.pnlStatus).toBeNull();
    expect(sell1.pnl!.equals(D('200'))).toBe(true);

    // Second sell: fresh position BUY 5@200, SELL 5@250 → pnl = (250−200)×5 = +250
    expect(sell2.pnlStatus).toBeNull();
    expect(sell2.pnl!.equals(D('250'))).toBe(true);

    // Pre-fix bug would have produced pnl ≈ 583.33 for sell2
    expect(sell2.pnl!.equals(D('583.33'))).toBe(false);
  });
});
