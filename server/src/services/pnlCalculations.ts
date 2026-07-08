import { Prisma } from '@prisma/client';

export interface BuyEntry {
  quantity: Prisma.Decimal;
  price: Prisma.Decimal;
  fee?: Prisma.Decimal | null;  // present only in net-cost queries
}

/**
 * Weighted average cost of a set of BUY entries.
 * avg = Σ(|qty| × price) / Σ(|qty|)
 * Returns null when there are no entries or total quantity is zero.
 */
export function calculateAverageCost(buyEntries: BuyEntry[]): Prisma.Decimal | null {
  if (buyEntries.length === 0) return null;

  let totalCost = new Prisma.Decimal(0);
  let totalQuantity = new Prisma.Decimal(0);

  for (const entry of buyEntries) {
    const qty = entry.quantity.abs();
    totalCost = totalCost.add(qty.mul(entry.price));
    totalQuantity = totalQuantity.add(qty);
  }

  if (totalQuantity.isZero()) return null;
  return totalCost.div(totalQuantity);
}

/**
 * Realized P&L for a single SELL.
 * pnl = (sellPrice − avgCost) × |sellQty|
 * Returns null when avgCost is null (no prior buys on record).
 */
export function calculatePnl(
  sellPrice: Prisma.Decimal,
  avgCost: Prisma.Decimal | null,
  sellQuantity: Prisma.Decimal,
): Prisma.Decimal | null {
  if (!avgCost) return null;
  return sellPrice.sub(avgCost).mul(sellQuantity.abs());
}

/**
 * Signed base value for an entry.
 * BUY:  -(|qty| × price)   [cash leaves the account]
 * SELL: +(|qty| × price)   [cash enters the account]
 */
export function calculateValueBase(
  entryType: 'BUY' | 'SELL',
  quantity: Prisma.Decimal,
  price: Prisma.Decimal,
): Prisma.Decimal {
  const rawValue = quantity.abs().mul(price);
  return entryType === 'BUY' ? rawValue.neg() : rawValue;
}

/**
 * Canonical signed quantity for DB storage.
 * BUY → positive, SELL → negative.
 */
export function toSignedQuantity(
  entryType: 'BUY' | 'SELL',
  quantity: Prisma.Decimal,
): Prisma.Decimal {
  return entryType === 'SELL' ? quantity.abs().neg() : quantity.abs();
}

/**
 * Fee-inclusive weighted average cost basis.
 * net_avg_cost = Σ(|qty| × price + buy_fee) / Σ(|qty|)
 * Returns null when there are no entries or total quantity is zero.
 */
export function calculateNetAverageCost(buyEntries: BuyEntry[]): Prisma.Decimal | null {
  if (buyEntries.length === 0) return null;

  let totalCost = new Prisma.Decimal(0);
  let totalQuantity = new Prisma.Decimal(0);

  for (const entry of buyEntries) {
    const qty = entry.quantity.abs();
    const fee = entry.fee ? entry.fee.abs() : new Prisma.Decimal(0);
    totalCost = totalCost.add(qty.mul(entry.price)).add(fee);
    totalQuantity = totalQuantity.add(qty);
  }

  if (totalQuantity.isZero()) return null;
  return totalCost.div(totalQuantity);
}

/**
 * Fee-inclusive realized P&L for a single SELL.
 * net_pnl = (sellPrice × |sellQty| − sellFee) − (netAvgCost × |sellQty|)
 * Returns null when netAvgCost is null (no prior buys on record).
 */
export function calculateNetPnl(
  sellPrice: Prisma.Decimal,
  sellFee: Prisma.Decimal | null,
  netAvgCost: Prisma.Decimal | null,
  sellQuantity: Prisma.Decimal,
): Prisma.Decimal | null {
  if (!netAvgCost) return null;
  const qty = sellQuantity.abs();
  const fee = sellFee ?? new Prisma.Decimal(0);
  const proceeds = sellPrice.mul(qty).sub(fee);
  return proceeds.sub(netAvgCost.mul(qty));
}

export interface SellPnlResult {
  pnl: Prisma.Decimal | null;
  netPnl: Prisma.Decimal | null;
  pnlStatus: string | null;
}

export interface RunningEntry {
  id: string;
  entryType: string;
  quantity: Prisma.Decimal;
  price: Prisma.Decimal;
  fee?: Prisma.Decimal | null;
}

/**
 * Computes realized P&L for each SELL in a chronological entry sequence using
 * running weighted-average cost. When a position reaches zero qty, the cost
 * accumulator resets so a reopened position starts a fresh cost basis — fixing
 * the bug where closed lots contaminate the new position's avg cost.
 *
 * entries must be sorted oldest-first. Returns a Map keyed by sell entry id.
 */
export function computeRunningPnl(entries: RunningEntry[]): Map<string, SellPnlResult> {
  let positionQty = new Prisma.Decimal(0);
  let positionCost = new Prisma.Decimal(0);
  let positionNetCost = new Prisma.Decimal(0);
  const results = new Map<string, SellPnlResult>();

  for (const entry of entries) {
    const qty = entry.quantity.abs();

    if (entry.entryType === 'BUY') {
      const fee = entry.fee ? entry.fee.abs() : new Prisma.Decimal(0);
      positionCost = positionCost.add(qty.mul(entry.price));
      positionNetCost = positionNetCost.add(qty.mul(entry.price)).add(fee);
      positionQty = positionQty.add(qty);
    } else if (entry.entryType === 'SELL') {
      if (positionQty.lte(0) || qty.gt(positionQty)) {
        results.set(entry.id, { pnl: null, netPnl: null, pnlStatus: 'PNL_UNCOMPUTABLE' });
      } else {
        const avgCost = positionCost.div(positionQty);
        const netAvgCost = positionNetCost.div(positionQty);
        const sellFee = entry.fee ? entry.fee.abs() : new Prisma.Decimal(0);

        results.set(entry.id, {
          pnl: entry.price.sub(avgCost).mul(qty),
          netPnl: entry.price.mul(qty).sub(sellFee).sub(netAvgCost.mul(qty)),
          pnlStatus: null,
        });

        positionCost = positionCost.sub(avgCost.mul(qty));
        positionNetCost = positionNetCost.sub(netAvgCost.mul(qty));
        positionQty = positionQty.sub(qty);

        if (positionQty.lte(0)) {
          positionQty = new Prisma.Decimal(0);
          positionCost = new Prisma.Decimal(0);
          positionNetCost = new Prisma.Decimal(0);
        }
      }
    }
  }

  return results;
}

/**
 * Computes the remaining cost basis of an open position after all entries are applied.
 * Uses the same running weighted-average algorithm as computeRunningPnl.
 * Returns Decimal(0) when there are no entries or the position is fully closed.
 */
export function computeOpenPositionCostBasis(entries: RunningEntry[]): Prisma.Decimal {
  let positionQty = new Prisma.Decimal(0);
  let positionCost = new Prisma.Decimal(0);

  for (const entry of entries) {
    const qty = entry.quantity.abs();

    if (entry.entryType === 'BUY') {
      positionCost = positionCost.add(qty.mul(entry.price));
      positionQty = positionQty.add(qty);
    } else if (entry.entryType === 'SELL') {
      if (!positionQty.lte(0) && !qty.gt(positionQty)) {
        const avgCost = positionCost.div(positionQty);
        positionCost = positionCost.sub(avgCost.mul(qty));
        positionQty = positionQty.sub(qty);
        if (positionQty.lte(0)) {
          positionQty = new Prisma.Decimal(0);
          positionCost = new Prisma.Decimal(0);
        }
      }
    }
  }

  return positionCost;
}

/**
 * Guardrailed P&L for a single SELL.
 * buyEntries must already be filtered to timestamp <= sell's timestamp (asOf).
 * Returns PNL_UNCOMPUTABLE when accumulated buy qty is zero or less than the sell qty.
 */
export function computeSellPnlResult(
  buyEntries: BuyEntry[],
  sellQty: Prisma.Decimal,
  sellPrice: Prisma.Decimal,
  sellFee: Prisma.Decimal | null,
): SellPnlResult {
  const accumBuyQty = buyEntries.reduce(
    (sum, e) => sum.add(e.quantity.abs()),
    new Prisma.Decimal(0),
  );
  const absQty = sellQty.abs();

  if (accumBuyQty.lte(0) || absQty.gt(accumBuyQty)) {
    return { pnl: null, netPnl: null, pnlStatus: 'PNL_UNCOMPUTABLE' };
  }

  return {
    pnl: calculatePnl(sellPrice, calculateAverageCost(buyEntries), sellQty),
    netPnl: calculateNetPnl(sellPrice, sellFee, calculateNetAverageCost(buyEntries), sellQty),
    pnlStatus: null,
  };
}
