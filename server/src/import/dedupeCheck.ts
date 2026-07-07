import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { NormalizedTrade } from './types';

export interface DedupeResult {
  duplicateIndices: Set<number>;
}

function computeHash(trade: NormalizedTrade): string {
  return createHash('sha256')
    .update(`${trade.timestamp.toISOString()}|${trade.symbol}|${trade.quantity.toFixed(8)}`)
    .digest('hex');
}

export async function checkDupes(
  trades: NormalizedTrade[],
  userId: string,
  prisma: PrismaClient,
): Promise<DedupeResult> {
  const duplicateIndices = new Set<number>();

  if (trades.length === 0) return { duplicateIndices };

  // Phase 1: batch-check trades that carry a sourceRowId
  const withSourceId = trades.filter(t => t.sourceRowId !== null);
  if (withSourceId.length > 0) {
    try {
      const results = await prisma.$transaction(
        withSourceId.map(t =>
          prisma.ledgerMetadata.findFirst({
            where: {
              key: 'importSourceRowId',
              value: t.sourceRowId!,
              ledgerEntry: { account: { userId } },
            },
          }),
        ),
      );
      results.forEach((hit, i) => {
        if (hit !== null) duplicateIndices.add(withSourceId[i].rawRowIndex);
      });
    } catch (err) {
      console.error('checkDupes: sourceRowId batch failed, treating as non-duplicates', err);
    }
  }

  // Phase 2: hash-check trades not yet marked duplicate (covers null sourceRowId + unfound sourceRowId)
  const needsHash = trades.filter(t => !duplicateIndices.has(t.rawRowIndex));
  if (needsHash.length > 0) {
    try {
      const hashes = needsHash.map(computeHash);
      const results = await prisma.$transaction(
        needsHash.map((_, i) =>
          prisma.ledgerMetadata.findFirst({
            where: {
              key: 'importRowHash',
              value: hashes[i],
              ledgerEntry: { account: { userId } },
            },
          }),
        ),
      );
      results.forEach((hit, i) => {
        if (hit !== null) duplicateIndices.add(needsHash[i].rawRowIndex);
      });
    } catch (err) {
      console.error('checkDupes: hash batch failed, treating as non-duplicates', err);
    }
  }

  return { duplicateIndices };
}
