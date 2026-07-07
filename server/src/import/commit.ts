import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../db';
import { parseCsv } from './parser';
import { PRESETS, generic } from './presets';
import { checkDupes } from './dedupeCheck';
import { calculateValueBase, toSignedQuantity } from '../services/pnlCalculations';
import { ledgerService } from '../services/ledgerService';
import type { ImportPreset, NormalizedTrade } from './types';

const VALID_PRESET_IDS = Object.keys(PRESETS);
const GENERIC_REQUIRED_COLUMNS = ['timestamp', 'quantity', 'price'] as const;

export interface CommitResult {
  succeeded: boolean;
  importedCount: number;
  duplicatesSkipped: number;
  accountId: string;
  accountCreated: boolean;
  error?: string;
}

function computeTradeHash(trade: NormalizedTrade): string {
  return createHash('sha256')
    .update(`${trade.timestamp.toISOString()}|${trade.symbol}|${trade.quantity.toFixed(8)}`)
    .digest('hex');
}

export async function commitImport(
  trades: NormalizedTrade[],
  userId: string,
  accountName: string,
  presetId: string,
  prismaClient: PrismaClient,
): Promise<CommitResult> {
  // Step 1 — Resolve account
  let accountCreated = false;
  let account = await prismaClient.account.findFirst({
    where: { userId, name: accountName, archivedAt: null },
  });
  if (!account) {
    account = await prismaClient.account.create({
      data: { userId, name: accountName, baseCurrency: 'USD' },
    });
    accountCreated = true;
  }
  const accountId = account.id;

  // Step 2 — Re-dedupe (preview result may be stale)
  const { duplicateIndices } = await checkDupes(trades, userId, prismaClient);
  const freshTrades = trades.filter(t => !duplicateIndices.has(t.rawRowIndex));
  const duplicatesSkipped = trades.length - freshTrades.length;

  if (freshTrades.length === 0) {
    return { succeeded: true, importedCount: 0, duplicatesSkipped, accountId, accountCreated };
  }

  // Step 3 — Write entries + metadata in a single transaction
  try {
    await prismaClient.$transaction(
      freshTrades.map(trade => {
        const qty = new Prisma.Decimal(trade.quantity.toString());
        const price = new Prisma.Decimal(trade.price.toString());
        const fee = trade.fee > 0 ? new Prisma.Decimal(trade.fee.toString()) : null;
        const signedQty = toSignedQuantity(trade.type, qty);
        const valueBase = calculateValueBase(trade.type, qty, price);

        return prismaClient.ledgerEntry.create({
          data: {
            accountId,
            timestamp: trade.timestamp,
            entryType: trade.type,
            symbol: trade.symbol,
            quantity: signedQty,
            price,
            fee,
            valueBase,
            pnl: null,
            netPnl: null,
            metadata: {
              create: [
                { key: 'importSourceRowId', value: trade.sourceRowId ?? '' },
                { key: 'importRowHash', value: computeTradeHash(trade) },
                { key: 'importPreset', value: presetId },
              ],
            },
          },
        });
      }),
    );
  } catch (err) {
    console.error('commitImport: transaction failed', err);
    return {
      succeeded: false,
      importedCount: 0,
      duplicatesSkipped,
      accountId,
      accountCreated,
      error: 'Transaction failed, no entries were written',
    };
  }

  // Step 4 — Recalculate P&L for all of the user's SELL entries
  try {
    await ledgerService.recalculateAllPnL(userId);
  } catch (err) {
    // Non-fatal: entries are committed, P&L can be recalculated via the existing endpoint
    console.error('commitImport: recalculate-pnl failed (entries were written)', err);
  }

  return { succeeded: true, importedCount: freshTrades.length, duplicatesSkipped, accountId, accountCreated };
}

export async function commitHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const fileArr = files?.['file'];
    if (!fileArr || fileArr.length === 0) {
      res.status(400).json({ error: 'file field is required' });
      return;
    }
    const fileText = fileArr[0].buffer.toString('utf-8');

    const { presetId, columnMap: columnMapStr, accountName } = req.body as {
      presetId?: string;
      columnMap?: string;
      accountName?: string;
    };

    if (!presetId || !VALID_PRESET_IDS.includes(presetId)) {
      res.status(400).json({ error: `presetId must be one of: ${VALID_PRESET_IDS.join('|')}` });
      return;
    }
    if (!accountName || accountName.trim().length === 0) {
      res.status(400).json({ error: 'accountName is required' });
      return;
    }
    if (accountName.trim().length > 100) {
      res.status(400).json({ error: 'accountName must be 100 characters or fewer' });
      return;
    }

    let preset: ImportPreset;
    if (presetId === 'generic') {
      if (!columnMapStr) {
        res.status(400).json({ error: 'columnMap is required when presetId is generic' });
        return;
      }
      let parsedMap: Record<string, string>;
      try {
        parsedMap = JSON.parse(columnMapStr);
      } catch {
        res.status(400).json({ error: 'columnMap must be valid JSON' });
        return;
      }
      if (typeof parsedMap !== 'object' || Array.isArray(parsedMap)) {
        res.status(400).json({ error: 'columnMap must be a JSON object' });
        return;
      }
      const missing = GENERIC_REQUIRED_COLUMNS.filter(k => !(k in parsedMap));
      if (missing.length > 0) {
        res.status(400).json({ error: `columnMap is missing required fields: ${missing.join(', ')}` });
        return;
      }
      preset = { ...generic, columnMap: parsedMap };
    } else {
      preset = PRESETS[presetId];
    }

    const { trades } = parseCsv(fileText, preset);
    const userId = req.user!.userId;

    const result = await commitImport(trades, userId, accountName.trim(), presetId, prisma);

    if (!result.succeeded) {
      res.status(500).json({ error: result.error ?? 'Import failed' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('commitHandler error:', err);
    res.status(500).json({ error: 'Import commit failed' });
  }
}
