import { describe, it, expect } from 'vitest';
import { parseCsv } from './parser';
import { coinbase_retail } from './presets';

// Realistic Coinbase retail export with a multi-line preamble, one BTC Sell,
// one Convert pair (BTC/USDC), one Advanced Trade Sell (ZEC), and one Withdrawal.
const COINBASE_CSV = `\
You can use this transaction report to inform your likely tax obligations.
Transactions
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes,Sender Address,Recipient Address
69f88c50,2026-05-04 12:08:48 UTC,Sell,BTC,-0.00084397,USD,$78727.85,$65.78,$64.55,$1.23,,,
6975442d,2026-01-24 22:14:05 UTC,Convert,BTC,0.00084397,USD,$89345.925,$75.40,$77.58,$2.18,,,
6975442d,2026-01-24 22:14:05 UTC,Convert,USDC,-77.589329,USD,$1.00,$77.58,$77.58,$0.00,,,
69611af1,2026-01-09 15:12:49 UTC,Advanced Trade Sell,ZEC,-0.01040187,USD,$424.71,-$4.41,-$4.39,$0.0265,,,
abc12345,2025-12-01 10:00:00 UTC,Withdrawal,USD,-100.00,USD,$1.00,-$100.00,-$100.00,$0.00,,,
`;

describe('parseCsv – coinbase_retail preset', () => {
  const result = parseCsv(COINBASE_CSV, coinbase_retail);

  it('produces exactly 3 trades (BTC Sell, BTC Convert BUY, ZEC Sell)', () => {
    expect(result.trades).toHaveLength(3);
  });

  it('BTC Sell row is typed as SELL with correct quantity and fee', () => {
    const t = result.trades.find(t => t.symbol === 'BTC' && t.type === 'SELL');
    expect(t).toBeDefined();
    expect(t!.quantity).toBeCloseTo(0.00084397);
    expect(t!.fee).toBeCloseTo(1.23);
    expect(t!.sourceRowId).toBe('69f88c50');
  });

  it('Convert pair (2 rows) collapses to a single BUY BTC trade', () => {
    const t = result.trades.find(t => t.symbol === 'BTC' && t.type === 'BUY');
    expect(t).toBeDefined();
    expect(t!.quantity).toBeCloseTo(0.00084397);
    expect(t!.fee).toBeCloseTo(2.18);
  });

  it('ZEC Advanced Trade Sell is typed as SELL with correct quantity and fee', () => {
    const t = result.trades.find(t => t.symbol === 'ZEC');
    expect(t).toBeDefined();
    expect(t!.type).toBe('SELL');
    expect(t!.quantity).toBeCloseTo(0.01040187);
    expect(t!.fee).toBeCloseTo(0.0265);
  });

  it('all trade quantities are positive', () => {
    expect(result.trades.every(t => t.quantity > 0)).toBe(true);
  });

  it('USDC Convert leg is in skipped as CASH_LEG_SKIPPED', () => {
    const cashSkips = result.skipped.filter(w => w.code === 'CASH_LEG_SKIPPED');
    expect(cashSkips.length).toBeGreaterThanOrEqual(1);
  });

  it('Withdrawal row is in skipped as NON_TRADE_SKIPPED', () => {
    const nonTrade = result.skipped.find(w => w.code === 'NON_TRADE_SKIPPED');
    expect(nonTrade).toBeDefined();
  });

  it('no PARSE_ERROR warnings', () => {
    const errors = result.skipped.filter(w => w.code === 'PARSE_ERROR');
    expect(errors).toHaveLength(0);
  });
});
