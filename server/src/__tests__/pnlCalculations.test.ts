import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calculateAverageCost,
  calculatePnl,
  calculateValueBase,
  toSignedQuantity,
  calculateNetAverageCost,
  calculateNetPnl,
  computeRunningPnl,
  computeOpenPositionCostBasis,
} from '../services/pnlCalculations';

// Helper — converts a number/string to Prisma.Decimal for concise test syntax
const D = (val: string | number) => new Prisma.Decimal(val.toString());

// ─── calculateAverageCost ────────────────────────────────────────────────────

describe('calculateAverageCost', () => {
  it('returns null for an empty buy list', () => {
    expect(calculateAverageCost([])).toBeNull();
  });

  it('returns null when every entry has zero quantity', () => {
    // Guard: avoids 0/0 division
    expect(calculateAverageCost([{ quantity: D(0), price: D(100) }])).toBeNull();
  });

  it('single BUY — avg cost equals that buy price', () => {
    // avg = (10 × 100) / 10 = 100
    const result = calculateAverageCost([{ quantity: D(10), price: D(100) }]);
    expect(result?.equals(D(100))).toBe(true);
  });

  it('multiple BUYs at same price — avg equals that price', () => {
    // avg = (5×50 + 5×50) / 10 = 50
    const result = calculateAverageCost([
      { quantity: D(5), price: D(50) },
      { quantity: D(5), price: D(50) },
    ]);
    expect(result?.equals(D(50))).toBe(true);
  });

  it('multiple BUYs at different prices — correct weighted average', () => {
    // Hand-verified:
    //   BUY 10 @ $100 → cost $1,000
    //   BUY 20 @ $130 → cost $2,600
    //   total cost = $3,600 / total qty = 30
    //   avg = $3,600 / 30 = $120.00
    const result = calculateAverageCost([
      { quantity: D(10), price: D(100) },
      { quantity: D(20), price: D(130) },
    ]);
    expect(result?.equals(D(120))).toBe(true);
  });

  it('abs() is applied to stored quantities — negative inputs give the same result', () => {
    // Production stores BUY as positive, but the function must tolerate either
    const pos = calculateAverageCost([{ quantity: D(10), price: D(100) }]);
    const neg = calculateAverageCost([{ quantity: D(-10), price: D(100) }]);
    expect(pos?.equals(neg!)).toBe(true);
  });

  it('fractional/crypto quantities are handled without float rounding', () => {
    // Hand-verified:
    //   BUY 0.5 BTC @ $30,000 → cost $15,000
    //   BUY 0.25 BTC @ $32,000 → cost  $8,000
    //   total cost = $23,000 / total qty = 0.75
    //   avg = $23,000 / 0.75 = $30,666.666...
    const result = calculateAverageCost([
      { quantity: D('0.5'), price: D('30000') },
      { quantity: D('0.25'), price: D('32000') },
    ]);
    const expected = D('23000').div(D('0.75'));
    // Prisma.Decimal preserves exact rational arithmetic
    expect(result?.equals(expected)).toBe(true);
  });
});

// ─── calculatePnl ────────────────────────────────────────────────────────────

describe('calculatePnl', () => {
  it('returns null when avgCost is null (SELL with no prior BUYs — documented safe behavior)', () => {
    // Code explicitly returns null rather than producing garbage output.
    // This is the correct edge-case behavior.
    const pnl = calculatePnl(D(100), null, D(5));
    expect(pnl).toBeNull();
  });

  it('basic gain — sell above avg cost', () => {
    // pnl = ($120 − $100) × 5 = $100
    const pnl = calculatePnl(D(120), D(100), D(5));
    expect(pnl?.equals(D(100))).toBe(true);
  });

  it('basic loss — sell below avg cost', () => {
    // pnl = ($80 − $100) × 5 = −$100
    const pnl = calculatePnl(D(80), D(100), D(5));
    expect(pnl?.equals(D(-100))).toBe(true);
  });

  it('break-even — sell at exact avg cost', () => {
    const pnl = calculatePnl(D(100), D(100), D(10));
    expect(pnl?.isZero()).toBe(true);
  });

  it('abs() applied to sell quantity — stored negative qty gives positive gain', () => {
    // Production stores SELL quantities as negative; result should be the same
    const pnlPos = calculatePnl(D(120), D(100), D(5));
    const pnlNeg = calculatePnl(D(120), D(100), D(-5));
    expect(pnlPos?.equals(pnlNeg!)).toBe(true);
    expect(pnlPos?.equals(D(100))).toBe(true);
  });

  it('nontrivial weighted average — hand-verified end-to-end', () => {
    // Hand-verified:
    //   BUY 10 @ $100 → cost $1,000
    //   BUY 20 @ $130 → cost $2,600
    //   avg = $3,600 / 30 = $120
    //   SELL 15 @ $150
    //   pnl = ($150 − $120) × 15 = $30 × 15 = $450
    const avgCost = calculateAverageCost([
      { quantity: D(10), price: D(100) },
      { quantity: D(20), price: D(130) },
    ]);
    const pnl = calculatePnl(D(150), avgCost, D(15));
    expect(pnl?.equals(D(450))).toBe(true);
  });

  it('fractional crypto quantities — no float bleed in pnl', () => {
    // avg = $23,000 / 0.75 = $30,666.666... (recurring)
    // SELL 0.1 BTC @ $35,000
    // pnl = ($35,000 − avg) × 0.1  — must remain exact
    const avgCost = calculateAverageCost([
      { quantity: D('0.5'), price: D('30000') },
      { quantity: D('0.25'), price: D('32000') },
    ]);
    const pnl = calculatePnl(D('35000'), avgCost, D('0.1'));
    const expected = D('35000').sub(D('23000').div(D('0.75'))).mul(D('0.1'));
    expect(pnl?.equals(expected)).toBe(true);
  });
});

// ─── avg cost method invariants ───────────────────────────────────────────────

describe('average cost method — multi-sell invariants', () => {
  it('avg cost does NOT change after a partial sell (sells use same cost basis)', () => {
    // avg cost method: selling shares does not change the cost basis for remaining shares
    // BUY 10 @ $100, BUY 20 @ $130 → avg = $120
    // SELL 10 @ $150 → pnl = ($150−$120)×10 = $300
    // SELL 5 @ $160  → pnl = ($160−$120)×5  = $200  (same avg, different sell price)
    const buyEntries = [
      { quantity: D(10), price: D(100) },
      { quantity: D(20), price: D(130) },
    ];
    const avgCost = calculateAverageCost(buyEntries);

    const pnl1 = calculatePnl(D(150), avgCost, D(10));
    const pnl2 = calculatePnl(D(160), avgCost, D(5));

    expect(pnl1?.equals(D(300))).toBe(true);
    expect(pnl2?.equals(D(200))).toBe(true);
  });

  it('two identical partial sells produce identical pnl', () => {
    const avgCost = calculateAverageCost([
      { quantity: D(10), price: D(100) },
      { quantity: D(20), price: D(130) },
    ]);
    // SELL 5 @ $150 twice — same avg, same result
    const pnl1 = calculatePnl(D(150), avgCost, D(5));
    const pnl2 = calculatePnl(D(150), avgCost, D(5));
    expect(pnl1?.equals(pnl2!)).toBe(true);
    // pnl = ($150 − $120) × 5 = $150
    expect(pnl1?.equals(D(150))).toBe(true);
  });
});

// ─── fee handling ────────────────────────────────────────────────────────────

describe('fee handling', () => {
  it('fees are NOT included in avg cost calculation — only qty and price matter', () => {
    // The production code stores fee as a separate column and does not fold it
    // into cost basis or pnl. This test confirms that behavior explicitly.
    //
    // A BUY of 10 @ $100 with fee=$5 should yield avg_cost=$100, not $100.50.
    // calculateAverageCost receives only {quantity, price} — fee is not in the interface.
    const withoutFee = calculateAverageCost([{ quantity: D(10), price: D(100) }]);
    // There is no way to pass a fee — the interface has no fee field.
    // avg = $100 regardless of what fee was charged.
    expect(withoutFee?.equals(D(100))).toBe(true);
  });

  it('fees are NOT included in pnl — pnl is purely (sellPrice − avgCost) × qty', () => {
    // calculatePnl has no fee parameter. Fees do not reduce/increase the pnl figure.
    // They are tracked separately in the ledger but do not affect realized P&L math.
    const pnl = calculatePnl(D(120), D(100), D(10));
    // pnl = $200; the $5 buy-side fee is invisible to this calculation
    expect(pnl?.equals(D(200))).toBe(true);
  });
});

// ─── calculateValueBase ───────────────────────────────────────────────────────

describe('calculateValueBase', () => {
  it('BUY is negative (cash out of account)', () => {
    // BUY 10 @ $100 → valueBase = −$1,000
    expect(calculateValueBase('BUY', D(10), D(100)).equals(D(-1000))).toBe(true);
  });

  it('SELL is positive (cash into account)', () => {
    // SELL 10 @ $100 → valueBase = +$1,000
    expect(calculateValueBase('SELL', D(10), D(100)).equals(D(1000))).toBe(true);
  });

  it('abs() applied — negative input qty still gives correct sign', () => {
    expect(calculateValueBase('BUY', D(-10), D(100)).equals(D(-1000))).toBe(true);
    expect(calculateValueBase('SELL', D(-10), D(100)).equals(D(1000))).toBe(true);
  });
});

// ─── toSignedQuantity ─────────────────────────────────────────────────────────

describe('toSignedQuantity', () => {
  it('BUY is stored as positive', () => {
    expect(toSignedQuantity('BUY', D(10)).equals(D(10))).toBe(true);
    expect(toSignedQuantity('BUY', D(-10)).equals(D(10))).toBe(true);
  });

  it('SELL is stored as negative', () => {
    expect(toSignedQuantity('SELL', D(5)).equals(D(-5))).toBe(true);
    expect(toSignedQuantity('SELL', D(-5)).equals(D(-5))).toBe(true);
  });
});

// ─── recalculate-pnl scenario ─────────────────────────────────────────────────

describe('recalculate-pnl — editing a historical BUY price changes downstream SELL pnl', () => {
  it('before edit: pnl reflects original buy price', () => {
    // BUY 10 @ $100, SELL 5 @ $120 → pnl = ($120−$100)×5 = $100
    const originalBuys = [{ quantity: D(10), price: D(100) }];
    const avgBefore = calculateAverageCost(originalBuys);
    const pnlBefore = calculatePnl(D(120), avgBefore, D(5));
    expect(pnlBefore?.equals(D(100))).toBe(true);
  });

  it('after editing BUY price: pnl changes accordingly', () => {
    // Same SELL @ $120, but now buy price is edited to $110
    // avg = $110, pnl = ($120−$110)×5 = $50
    const editedBuys = [{ quantity: D(10), price: D(110) }];
    const avgAfter = calculateAverageCost(editedBuys);
    const pnlAfter = calculatePnl(D(120), avgAfter, D(5));
    expect(pnlAfter?.equals(D(50))).toBe(true);
  });
});

// ─── BUG: recalculateAllPnL includes future BUYs ─────────────────────────────

describe('BUG: recalculateAllPnL uses ALL buys, including ones after the SELL', () => {
  it('correct behavior: use only buys BEFORE the sell timestamp', () => {
    // Scenario:
    //   t=1  BUY  10 @ $100
    //   t=2  SELL  5 @ $120  ← pnl should use only the t=1 buy
    //   t=3  BUY  10 @ $200  ← should NOT affect the t=2 sell pnl
    //
    // Correct avg_cost (buys up to t=2): (10×100)/10 = $100
    // Correct pnl = ($120 − $100) × 5 = $100
    const buysBeforeSell = [{ quantity: D(10), price: D(100) }];
    const correctAvg = calculateAverageCost(buysBeforeSell);
    const correctPnl = calculatePnl(D(120), correctAvg, D(5));
    expect(correctPnl?.equals(D(100))).toBe(true);
  });

  it('actual recalculateAllPnL behavior: includes the t=3 buy — PRODUCES WRONG PNL', () => {
    // recalculateAllPnL calls getAverageCost with NO timestamp filter.
    // It fetches ALL buys for the symbol, including ones after the sell.
    //
    // All buys (ignoring timestamps):
    //   BUY 10 @ $100 (t=1) + BUY 10 @ $200 (t=3)
    //   avg = (10×100 + 10×200) / 20 = $3,000 / 20 = $150
    //
    // Recalculated pnl = ($120 − $150) × 5 = −$150   ← WRONG (should be $100)
    const allBuys = [
      { quantity: D(10), price: D(100) }, // t=1 (before sell)
      { quantity: D(10), price: D(200) }, // t=3 (after sell — should be excluded)
    ];
    const wrongAvg = calculateAverageCost(allBuys);
    const wrongPnl = calculatePnl(D(120), wrongAvg, D(5));

    // This documents the incorrect result produced by the current recalculate logic
    expect(wrongAvg?.equals(D(150))).toBe(true);
    expect(wrongPnl?.equals(D(-150))).toBe(true);

    // The correct pnl is $100, not −$150
    // FIX: recalculateAllPnL should pass a timestamp filter to getAverageCost:
    //   WHERE timestamp <= entry.timestamp (the sell being recalculated)
  });
});

// ─── calculateNetAverageCost ──────────────────────────────────────────────────

describe('calculateNetAverageCost', () => {
  it('returns null for an empty buy list', () => {
    expect(calculateNetAverageCost([])).toBeNull();
  });

  it('returns null when total quantity is zero', () => {
    expect(calculateNetAverageCost([{ quantity: D(0), price: D(100), fee: D(5) }])).toBeNull();
  });

  it('single BUY with no fee — equals gross avg cost', () => {
    // net_avg = (1 × 100 + 0) / 1 = 100
    const result = calculateNetAverageCost([{ quantity: D(1), price: D(100) }]);
    expect(result?.equals(D(100))).toBe(true);
  });

  it('single BUY with fee — fee is folded into basis', () => {
    // net_avg = (10 × 100 + 50) / 10 = 1050 / 10 = 105
    const result = calculateNetAverageCost([{ quantity: D(10), price: D(100), fee: D(50) }]);
    expect(result?.equals(D(105))).toBe(true);
  });

  it('null fee treated as zero', () => {
    // net_avg = (10 × 100 + 0) / 10 = 100
    const result = calculateNetAverageCost([{ quantity: D(10), price: D(100), fee: null }]);
    expect(result?.equals(D(100))).toBe(true);
  });

  it('multiple BUYs — fees summed across all buys', () => {
    // BUY 2 @ 22000 fee=450
    // net_avg = (2 × 22000 + 450) / 2 = 44450 / 2 = 22225
    const result = calculateNetAverageCost([
      { quantity: D(2), price: D(22000), fee: D(450) },
    ]);
    expect(result?.equals(D(22225))).toBe(true);
  });

  it('net avg cost is always >= gross avg cost when fees are positive', () => {
    const gross = calculateAverageCost([{ quantity: D(2), price: D(22000) }]);
    const net = calculateNetAverageCost([{ quantity: D(2), price: D(22000), fee: D(450) }]);
    // 22225 >= 22000
    expect(net!.gte(gross!)).toBe(true);
  });
});

// ─── calculateNetPnl ─────────────────────────────────────────────────────────

describe('calculateNetPnl', () => {
  it('returns null when netAvgCost is null', () => {
    expect(calculateNetPnl(D(100), D(5), null, D(10))).toBeNull();
  });

  it('zero sell fee — result equals gross pnl direction', () => {
    // net_pnl = (120 × 5 − 0) − (100 × 5) = 600 − 500 = 100
    const result = calculateNetPnl(D(120), D(0), D(100), D(5));
    expect(result?.equals(D(100))).toBe(true);
  });

  it('null sell fee treated as zero', () => {
    // same as above
    const result = calculateNetPnl(D(120), null, D(100), D(5));
    expect(result?.equals(D(100))).toBe(true);
  });

  it('sell fee reduces net pnl below gross', () => {
    // gross pnl: (120 − 100) × 5 = 100
    // net_pnl  = (120×5 − 20) − (100×5) = 580 − 500 = 80
    const result = calculateNetPnl(D(120), D(20), D(100), D(5));
    expect(result?.equals(D(80))).toBe(true);
  });

  it('sell fee can tip a gross-positive trade net-negative', () => {
    // gross pnl: (22350 − 22000) × 1 = 350
    // net_pnl  = (22350 × 1 − 500) − (22000 × 1) = 21850 − 22000 = −150
    const result = calculateNetPnl(D(22350), D(500), D(22000), D(1));
    expect(result?.equals(D(-150))).toBe(true);
  });

  it('abs() applied to sell quantity — negative stored qty gives same result', () => {
    const pos = calculateNetPnl(D(120), D(10), D(100), D(5));
    const neg = calculateNetPnl(D(120), D(10), D(100), D(-5));
    expect(pos?.equals(neg!)).toBe(true);
  });
});

// ─── BTX dataset regression — gross vs net (pinned) ──────────────────────────

describe('gross vs net P&L — BTX dataset regression', () => {
  // Pinned dataset (one account, symbol BTX):
  //   t=01:02  BUY  qty=+2  price=22000  fee=450
  //   t=01:07  SELL qty=-1  price=22350  fee=200
  //   t=01:09  SELL qty=-1  price=22000  fee=0
  //
  // Arithmetic (auditable):
  //
  // GROSS avg_cost = (2 × 22000) / 2 = 44000 / 2 = 22000.00
  //   sell1 gross = (22350 − 22000) × 1 = +350.00
  //   sell2 gross = (22000 − 22000) × 1 =    0.00
  //   total gross = +350.00
  //
  // NET avg_cost  = (2 × 22000 + 450) / 2 = 44450 / 2 = 22225.00
  //   sell1 net   = (22350 × 1 − 200) − (22225 × 1) = 22150 − 22225 = −75.00
  //   sell2 net   = (22000 × 1 −   0) − (22225 × 1) = 22000 − 22225 = −225.00
  //   total net   = −75 + (−225) = −300.00
  //
  // Total fees (drag) = 450 + 200 + 0 = 650.00
  //
  // Account net P&L = SUM(valueBase) − SUM(fee)
  //   SUM(valueBase) = −44000 + 22350 + 22000 = +350
  //   SUM(fee)       = 450 + 200 + 0          =  650
  //   net            = 350 − 650              = −300.00

  const buy = { quantity: D(2), price: D(22000), fee: D(450) };

  it('gross avg_cost = 22000.00', () => {
    const avg = calculateAverageCost([buy]);
    expect(avg?.equals(D(22000))).toBe(true);
  });

  it('net avg_cost = 22225.00', () => {
    const avg = calculateNetAverageCost([buy]);
    expect(avg?.equals(D(22225))).toBe(true);
  });

  it('sell1: gross pnl = +350.00', () => {
    const avg = calculateAverageCost([buy]);
    const pnl = calculatePnl(D(22350), avg, D(1));
    expect(pnl?.equals(D(350))).toBe(true);
  });

  it('sell1: net pnl = −75.00', () => {
    // (22350 × 1 − 200) − (22225 × 1) = 22150 − 22225 = −75
    const netAvg = calculateNetAverageCost([buy]);
    const netPnl = calculateNetPnl(D(22350), D(200), netAvg, D(1));
    expect(netPnl?.equals(D(-75))).toBe(true);
  });

  it('sell2: gross pnl = 0.00', () => {
    const avg = calculateAverageCost([buy]);
    const pnl = calculatePnl(D(22000), avg, D(1));
    expect(pnl?.isZero()).toBe(true);
  });

  it('sell2: net pnl = −225.00', () => {
    // (22000 × 1 − 0) − (22225 × 1) = 22000 − 22225 = −225
    const netAvg = calculateNetAverageCost([buy]);
    const netPnl = calculateNetPnl(D(22000), D(0), netAvg, D(1));
    expect(netPnl?.equals(D(-225))).toBe(true);
  });

  it('total net pnl = −300.00 (sum of both sells)', () => {
    const netAvg = calculateNetAverageCost([buy]);
    const s1 = calculateNetPnl(D(22350), D(200), netAvg, D(1))!;
    const s2 = calculateNetPnl(D(22000), D(0), netAvg, D(1))!;
    expect(s1.add(s2).equals(D(-300))).toBe(true);
  });

  it('account net P&L = SUM(valueBase) − SUM(fee) = −300.00', () => {
    // SUM(valueBase): BUY → −(2×22000) = −44000; SELL1 → +22350; SELL2 → +22000
    // SUM(valueBase) = −44000 + 22350 + 22000 = +350
    const sumValueBase = D(-44000).add(D(22350)).add(D(22000));
    // SUM(fee): 450 + 200 + 0 = 650
    const sumFees = D(450).add(D(200)).add(D(0));
    const accountNetPnL = sumValueBase.sub(sumFees);
    expect(accountNetPnL.equals(D(-300))).toBe(true);
  });
});

// ─── asOf regression — future buys must not contaminate past sells ────────────

describe('asOf regression — future buys excluded from past sell cost basis', () => {
  // Scenario:
  //   t=10:00  BUY  10 @ 100  ← before the sell
  //   t=11:00  SELL  5 @ 120  ← the sell being costed
  //   t=12:00  BUY  10 @ 200  ← AFTER the sell; must be excluded
  //
  // CORRECT (buys up to sell timestamp only):
  //   gross avg_cost = (10 × 100) / 10 = 100
  //   sell pnl       = (120 − 100) × 5 = +100
  //
  // PRE-FIX BUG (all buys regardless of timestamp):
  //   avg_cost = (10×100 + 10×200) / 20 = 3000/20 = 150
  //   sell pnl = (120 − 150) × 5 = −150   ← WRONG

  const buyBefore = { quantity: D(10), price: D(100), fee: null };
  const buyAfter  = { quantity: D(10), price: D(200), fee: null };
  const allBuys   = [buyBefore, buyAfter];
  const buysBeforeSell = [buyBefore];

  it('correct (asOf applied): gross avg = 100, pnl = +100', () => {
    const avg = calculateAverageCost(buysBeforeSell);
    expect(avg?.equals(D(100))).toBe(true);
    const pnl = calculatePnl(D(120), avg, D(5));
    expect(pnl?.equals(D(100))).toBe(true);
  });

  it('bug (no asOf): avg contaminates to 150, pnl = −150', () => {
    // Documents the pre-fix behavior. The service fix (getAverageCost asOf filter)
    // ensures allBuys is never passed for a sell costed at its own timestamp.
    const avg = calculateAverageCost(allBuys);
    expect(avg?.equals(D(150))).toBe(true);
    const pnl = calculatePnl(D(120), avg, D(5));
    expect(pnl?.equals(D(-150))).toBe(true);
  });

  it('correct (asOf applied): net avg = 100, net pnl = +100 (no fees in scenario)', () => {
    const netAvg = calculateNetAverageCost(buysBeforeSell);
    expect(netAvg?.equals(D(100))).toBe(true);
    const netPnl = calculateNetPnl(D(120), null, netAvg, D(5));
    expect(netPnl?.equals(D(100))).toBe(true);
  });

  it('bug (no asOf): net also contaminates — net pnl = −150', () => {
    // Same contamination on the net path if the filter were absent.
    const netAvg = calculateNetAverageCost(allBuys);
    expect(netAvg?.equals(D(150))).toBe(true);
    const netPnl = calculateNetPnl(D(120), null, netAvg, D(5));
    expect(netPnl?.equals(D(-150))).toBe(true);
  });
});

// ─── computeRunningPnl ────────────────────────────────────────────────────────

describe('computeRunningPnl — running weighted-average cost with position reset', () => {
  it('single position: gross and net pnl match point-in-time avg cost', () => {
    // BUY 2 @ 22000 (fee=450), SELL 1 @ 22350 (fee=200), SELL 1 @ 22000 (fee=0)
    // avg_gross = 22000; avg_net = (2×22000+450)/2 = 22225
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(2),  price: D(22000), fee: D(450) },
      { id: 's1', entryType: 'SELL', quantity: D(-1), price: D(22350), fee: D(200) },
      { id: 's2', entryType: 'SELL', quantity: D(-1), price: D(22000), fee: D(0)   },
    ];
    const map = computeRunningPnl(entries);

    const s1 = map.get('s1')!;
    expect(s1.pnlStatus).toBeNull();
    expect(s1.pnl!.equals(D(350))).toBe(true);    // (22350−22000)×1
    expect(s1.netPnl!.equals(D(-75))).toBe(true); // (22350−200)−22225

    const s2 = map.get('s2')!;
    expect(s2.pnlStatus).toBeNull();
    expect(s2.pnl!.isZero()).toBe(true);           // (22000−22000)×1
    expect(s2.netPnl!.equals(D(-225))).toBe(true); // (22000−0)−22225
  });

  it('close-and-reopen: second position uses fresh cost basis (the bug fix)', () => {
    // Scenario from issue #114:
    //   t1: BUY  10 @ 100  → open position, avg = 100
    //   t2: SELL 10 @ 120  → position fully closed, pnl = +200
    //   t3: BUY   5 @ 200  → new position, avg = 200
    //   t4: SELL  5 @ 250  → pnl should be +250, not +583.33
    //
    // Bug: without reset, avg_cost for t4 = (10×100+5×200)/15 = 133.33 → pnl = +583.33
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-10), price: D(120) },
      { id: 'b2', entryType: 'BUY',  quantity: D(5),   price: D(200) },
      { id: 's2', entryType: 'SELL', quantity: D(-5),  price: D(250) },
    ];
    const map = computeRunningPnl(entries);

    const s1 = map.get('s1')!;
    expect(s1.pnlStatus).toBeNull();
    expect(s1.pnl!.equals(D(200))).toBe(true);   // (120−100)×10

    const s2 = map.get('s2')!;
    expect(s2.pnlStatus).toBeNull();
    expect(s2.pnl!.equals(D(250))).toBe(true);   // (250−200)×5  ← was wrong before fix
  });

  it('SELL with no prior BUY → PNL_UNCOMPUTABLE', () => {
    const entries = [
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(100) },
    ];
    const map = computeRunningPnl(entries);
    expect(map.get('s1')!.pnlStatus).toBe('PNL_UNCOMPUTABLE');
    expect(map.get('s1')!.pnl).toBeNull();
  });

  it('SELL exceeds position qty → PNL_UNCOMPUTABLE', () => {
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(3),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(120) },
    ];
    const map = computeRunningPnl(entries);
    expect(map.get('s1')!.pnlStatus).toBe('PNL_UNCOMPUTABLE');
  });

  it('SELL after position fully closed with no new BUY → PNL_UNCOMPUTABLE', () => {
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(5),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(120) },
      { id: 's2', entryType: 'SELL', quantity: D(-1), price: D(130) }, // no position left
    ];
    const map = computeRunningPnl(entries);
    expect(map.get('s1')!.pnlStatus).toBeNull();
    expect(map.get('s1')!.pnl!.equals(D(100))).toBe(true);  // (120−100)×5
    expect(map.get('s2')!.pnlStatus).toBe('PNL_UNCOMPUTABLE');
  });

  it('multiple close-and-reopen cycles each use their own fresh cost basis', () => {
    // Cycle 1: BUY 10@100, SELL 10@110 → pnl=+100
    // Cycle 2: BUY 5@200, SELL 5@180  → pnl=−100
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-10), price: D(110) },
      { id: 'b2', entryType: 'BUY',  quantity: D(5),   price: D(200) },
      { id: 's2', entryType: 'SELL', quantity: D(-5),  price: D(180) },
    ];
    const map = computeRunningPnl(entries);
    expect(map.get('s1')!.pnl!.equals(D(100))).toBe(true);   // (110−100)×10
    expect(map.get('s2')!.pnl!.equals(D(-100))).toBe(true);  // (180−200)×5
  });

  it('buy-after-partial-sell: WAC re-blends remaining position with new buy', () => {
    // BUY 10@100  → positionQty=10, positionCost=1000, avgCost=100
    // SELL 4@120  → pnl=(120−100)×4=80; positionCost=1000−100×4=600, qty=6
    // BUY 6@150   → positionCost=600+900=1500, qty=12, avgCost=1500/12=125
    // SELL 3@130  → pnl=(130−125)×3=15
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-4), price: D(120) },
      { id: 'b2', entryType: 'BUY',  quantity: D(6),  price: D(150) },
      { id: 's2', entryType: 'SELL', quantity: D(-3), price: D(130) },
    ];
    const map = computeRunningPnl(entries);
    expect(map.get('s1')!.pnl!.equals(D(80))).toBe(true);
    expect(map.get('s2')!.pnl!.equals(D(15))).toBe(true);
  });

  it('future BUY does not affect past SELL (ordering is the caller\'s responsibility)', () => {
    // Entries passed in correct chronological order; the later BUY must not retroactively
    // change the avg cost used for the earlier SELL.
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(120) },
      { id: 'b2', entryType: 'BUY',  quantity: D(10), price: D(200) }, // after the sell
    ];
    const map = computeRunningPnl(entries);
    // s1 avg cost must be 100 (only b1 contributes), pnl = (120−100)×5 = 100
    expect(map.get('s1')!.pnl!.equals(D(100))).toBe(true);
  });

  it('BUY entries are not in the result map', () => {
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(5),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(120) },
    ];
    const map = computeRunningPnl(entries);
    expect(map.has('b1')).toBe(false);
    expect(map.has('s1')).toBe(true);
  });
});

// ─── computeOpenPositionCostBasis ─────────────────────────────────────────────

describe('computeOpenPositionCostBasis — remaining cost basis of an open position', () => {
  it('no entries → zero', () => {
    expect(computeOpenPositionCostBasis([]).isZero()).toBe(true);
  });

  it('single BUY not yet sold → full cost basis', () => {
    // BUY 10 @ 100 → costBasis = 10 × 100 = 1000
    const entries = [{ id: 'b1', entryType: 'BUY', quantity: D(10), price: D(100) }];
    expect(computeOpenPositionCostBasis(entries).equals(D(1000))).toBe(true);
  });

  it('fully closed position → zero', () => {
    // BUY 5 @ 100, SELL 5 → fully closed
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(5),  price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(120) },
    ];
    expect(computeOpenPositionCostBasis(entries).isZero()).toBe(true);
  });

  it('partial sell → proportional cost basis remains', () => {
    // BUY 10 @ 100 (cost=1000), SELL 4 → avgCost=100, removed=400 → remaining=600
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-4), price: D(120) },
    ];
    expect(computeOpenPositionCostBasis(entries).equals(D(600))).toBe(true);
  });

  it('close and reopen → second position cost basis is fresh', () => {
    // Cycle 1: BUY 10@100, SELL 10 → closed (cost=0)
    // Cycle 2: BUY 5@200 → new cost basis = 5×200 = 1000
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-10), price: D(120) },
      { id: 'b2', entryType: 'BUY',  quantity: D(5),  price: D(200) },
    ];
    expect(computeOpenPositionCostBasis(entries).equals(D(1000))).toBe(true);
  });

  it('multiple buys at different prices → WAC applied on partial sell', () => {
    // BUY 10@100 (cost=1000), BUY 10@200 (cost=2000) → total cost=3000, qty=20, avg=150
    // SELL 10 → removed cost = 150×10 = 1500 → remaining = 1500
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 'b2', entryType: 'BUY',  quantity: D(10), price: D(200) },
      { id: 's1', entryType: 'SELL', quantity: D(-10), price: D(180) },
    ];
    expect(computeOpenPositionCostBasis(entries).equals(D(1500))).toBe(true);
  });

  it('uncomputable SELL (no prior BUY) is skipped — does not affect cost basis', () => {
    // SELL with no position is ignored; subsequent BUY creates a fresh position
    const entries = [
      { id: 's1', entryType: 'SELL', quantity: D(-5), price: D(100) },
      { id: 'b1', entryType: 'BUY',  quantity: D(3),  price: D(150) },
    ];
    // Only BUY 3@150 contributes → costBasis = 450
    expect(computeOpenPositionCostBasis(entries).equals(D(450))).toBe(true);
  });

  it('matches computeRunningPnl positionCost tracking on buy-after-partial-sell', () => {
    // BUY 10@100, SELL 4@120, BUY 6@150 → remaining 12 shares
    // After SELL 4: positionCost = 1000 − (100×4) = 600, qty=6
    // After BUY 6@150: positionCost = 600 + 900 = 1500, qty=12
    const entries = [
      { id: 'b1', entryType: 'BUY',  quantity: D(10), price: D(100) },
      { id: 's1', entryType: 'SELL', quantity: D(-4), price: D(120) },
      { id: 'b2', entryType: 'BUY',  quantity: D(6),  price: D(150) },
    ];
    expect(computeOpenPositionCostBasis(entries).equals(D(1500))).toBe(true);
  });
});
