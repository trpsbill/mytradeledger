import { Request, Response } from 'express';
import prisma from '../db';
import { parseCsv } from './parser';
import { PRESETS, generic } from './presets';
import { checkDupes } from './dedupeCheck';
import type { ImportPreset, NormalizedTrade, ParseWarning } from './types';

const VALID_PRESET_IDS = Object.keys(PRESETS);
const GENERIC_REQUIRED_COLUMNS = ['timestamp', 'quantity', 'price'] as const;

interface PreviewResponse {
  willImport: NormalizedTrade[];
  duplicates: NormalizedTrade[];
  skipped: ParseWarning[];
  warnings: ParseWarning[];
  summary: {
    willImportCount: number;
    duplicateCount: number;
    skippedCount: number;
    missingFeeCount: number;
    hasMissingFees: boolean;
  };
}

export async function previewHandler(req: Request, res: Response): Promise<void> {
  try {
    // ── Resolve uploaded file ────────────────────────────────────────────────
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const fileArr = files?.['file'];
    if (!fileArr || fileArr.length === 0) {
      res.status(400).json({ error: 'file field is required' });
      return;
    }
    const fileText = fileArr[0].buffer.toString('utf-8');

    // ── Resolve preset ───────────────────────────────────────────────────────
    const { presetId, columnMap: columnMapStr } = req.body as {
      presetId?: string;
      columnMap?: string;
    };

    if (!presetId || !VALID_PRESET_IDS.includes(presetId)) {
      res.status(400).json({ error: `presetId must be one of: ${VALID_PRESET_IDS.join('|')}` });
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

    // ── Parse CSV ────────────────────────────────────────────────────────────
    const { trades, skipped, warnings } = parseCsv(fileText, preset);

    // ── Dedupe check ─────────────────────────────────────────────────────────
    const userId = req.user!.userId;
    const { duplicateIndices } = await checkDupes(trades, userId, prisma);

    const willImport: NormalizedTrade[] = [];
    const duplicates: NormalizedTrade[] = [];
    for (const trade of trades) {
      if (duplicateIndices.has(trade.rawRowIndex)) duplicates.push(trade);
      else willImport.push(trade);
    }

    const missingFeeCount = warnings.filter(w => w.code === 'MISSING_FEE').length;

    const response: PreviewResponse = {
      willImport,
      duplicates,
      skipped,
      warnings,
      summary: {
        willImportCount: willImport.length,
        duplicateCount: duplicates.length,
        skippedCount: skipped.length,
        missingFeeCount,
        hasMissingFees: missingFeeCount > 0,
      },
    };

    res.json(response);
  } catch (err) {
    console.error('previewHandler error:', err);
    res.status(500).json({ error: 'Import preview failed' });
  }
}
