import type { ImportPreset, NormalizedTrade, ParseResult, ParseWarning, TradeDirection } from './types';

// ─── Low-level CSV helpers ────────────────────────────────────────────────────

/** RFC-4180-compatible CSV line splitter. Handles quoted fields with embedded commas and doubled-quote escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      fields.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

/** Strips currency symbols and thousands separators, then parses as float. Returns 0 for empty/NaN. */
function parseNumeric(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[$,]/g, '').trim());
  return isNaN(n) ? 0 : n;
}

/** Handles "YYYY-MM-DD HH:MM:SS UTC" and standard ISO variants. */
function parseTimestamp(s: string): Date {
  return new Date(s.replace(' UTC', 'Z').replace(' ', 'T'));
}

// ─── Symbol helpers ───────────────────────────────────────────────────────────

/** Splits a trading pair into base/quote. Uses `delimiter` when provided; otherwise strips a known quote suffix. */
function splitPair(
  pair: string,
  delimiter: string | null,
  cashAssets: string[],
): { base: string; quote: string } | null {
  if (delimiter) {
    const idx = pair.indexOf(delimiter);
    if (idx > 0) return { base: pair.slice(0, idx), quote: pair.slice(idx + delimiter.length) };
    return null;
  }
  // Match longest known cash suffix first to avoid partial collisions (e.g. BUSD vs USD)
  const sorted = [...cashAssets].sort((a, b) => b.length - a.length);
  for (const cash of sorted) {
    if (pair.toUpperCase().endsWith(cash.toUpperCase())) {
      return { base: pair.slice(0, pair.length - cash.length), quote: cash };
    }
  }
  return null;
}

// ─── Direction helpers ────────────────────────────────────────────────────────

type TypeColumnResult = TradeDirection | 'CONVERT' | 'NON_TRADE' | 'UNRESOLVED';

function resolveTypeColumn(rawType: string): TypeColumnResult {
  const t = rawType.toLowerCase().trim();
  if (!t) return 'UNRESOLVED';
  if (t.includes('buy')) return 'BUY';
  if (t.includes('sell')) return 'SELL';
  if (t === 'convert') return 'CONVERT';
  return 'NON_TRADE';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCsv(rawText: string, preset: ImportPreset): ParseResult {
  const trades: NormalizedTrade[] = [];
  const skipped: ParseWarning[] = [];
  const warnings: ParseWarning[] = [];

  const lines = rawText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { trades, skipped, warnings };

  // Locate header row: first row whose first cell matches the first preset columnMap value.
  // This naturally skips any exchange preamble (e.g. Coinbase's multi-line intro text).
  const expectedFirstCol = Object.values(preset.columnMap)[0];
  let headerIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (parseCsvLine(lines[i])[0] === expectedFirstCol) { headerIdx = i; break; }
  }

  const headerCells = parseCsvLine(lines[headerIdx]);
  const colByName: Record<string, number> = {};
  headerCells.forEach((h, i) => { colByName[h] = i; });

  // Map internal preset keys → column index
  const keyToIdx: Record<string, number> = {};
  for (const [key, csvHeader] of Object.entries(preset.columnMap)) {
    if (colByName[csvHeader] !== undefined) keyToIdx[key] = colByName[csvHeader];
  }

  interface RawRow { cells: string[]; rowIndex: number; }

  const rawRows: RawRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    rawRows.push({ cells: parseCsvLine(lines[i]), rowIndex: i - headerIdx - 1 });
  }

  const get = (row: RawRow, key: string): string => {
    const idx = keyToIdx[key];
    return idx !== undefined ? (row.cells[idx] ?? '').trim() : '';
  };

  const applyAliases = (sym: string): string => preset.symbolAliases[sym] ?? sym;
  const isCash = (sym: string): boolean =>
    preset.cashAssets.some(c => c.toUpperCase() === sym.toUpperCase());

  function skip(row: RawRow, code: ParseWarning['code'], message: string) {
    skipped.push({ rawRowIndex: row.rowIndex, code, message });
  }

  function commitTrade(
    row: RawRow,
    symbol: string,
    type: TradeDirection,
    quantityRaw: number,
    priceRaw: number,
    feeRaw: number,
  ) {
    const quantity = Math.abs(quantityRaw);
    const price = Math.abs(priceRaw);
    const fee = Math.abs(feeRaw);
    if (quantity === 0) { skip(row, 'NON_TRADE_SKIPPED', `Zero quantity for ${symbol}`); return; }

    trades.push({
      sourceRowId: get(row, 'id') || null,
      timestamp: parseTimestamp(get(row, 'timestamp')),
      symbol,
      type,
      quantity,
      price,
      fee,
      feeCurrency: get(row, 'priceCurrency') || null,
      rawRowIndex: row.rowIndex,
    });

    if (fee === 0) {
      warnings.push({ rawRowIndex: row.rowIndex, code: 'MISSING_FEE', message: `No fee for ${symbol} ${type}` });
    }
  }

  function processRow(row: RawRow) {
    try {
      let type: TradeDirection;
      let symbol: string;

      // ── Direction ─────────────────────────────────────────────────────────
      if (preset.directionMode === 'typeColumn') {
        const rawType = get(row, 'type');
        const d = resolveTypeColumn(rawType);
        if (d === 'NON_TRADE') { skip(row, 'NON_TRADE_SKIPPED', `Transaction type "${rawType}"`); return; }
        if (d === 'UNRESOLVED') { skip(row, 'UNRESOLVED_DIRECTION', `Unknown type "${rawType}"`); return; }
        if (d === 'CONVERT') { skip(row, 'UNPAIRED_LEG', `Unpaired Convert row`); return; }
        type = d;
      } else if (preset.directionMode === 'sideColumn') {
        const s = get(row, 'side').toUpperCase().trim();
        if (s === 'BUY') { type = 'BUY'; }
        else if (s === 'SELL') { type = 'SELL'; }
        else { skip(row, 'UNRESOLVED_DIRECTION', `Unknown side "${get(row, 'side')}"`); return; }
      } else {
        // amountSign
        const rawQty = parseNumeric(get(row, 'quantity'));
        if (rawQty > 0) { type = 'BUY'; }
        else if (rawQty < 0) { type = 'SELL'; }
        else { skip(row, 'UNRESOLVED_DIRECTION', 'Zero quantity, cannot determine direction'); return; }
      }

      // ── Symbol ────────────────────────────────────────────────────────────
      if (preset.symbolMode === 'single') {
        const rawAsset = get(row, 'asset');
        if (preset.skipBlankAssetRows && !rawAsset) { skip(row, 'NON_TRADE_SKIPPED', 'Blank asset'); return; }
        symbol = applyAliases(rawAsset);
        if (isCash(symbol)) { skip(row, 'CASH_LEG_SKIPPED', `${symbol} is a cash asset`); return; }
      } else {
        const rawPair = get(row, 'pair');
        const split = splitPair(rawPair, preset.pairDelimiter, preset.cashAssets);
        if (!split) { skip(row, 'PARSE_ERROR', `Cannot split pair "${rawPair}"`); return; }
        symbol = applyAliases(split.base);
        if (isCash(symbol)) { skip(row, 'CASH_LEG_SKIPPED', `${symbol} is a cash asset`); return; }
      }

      commitTrade(row, symbol, type, parseNumeric(get(row, 'quantity')), parseNumeric(get(row, 'price')), parseNumeric(get(row, 'fee')));
    } catch (err) {
      skipped.push({ rawRowIndex: row.rowIndex, code: 'PARSE_ERROR', message: String(err) });
    }
  }

  function processPair(a: RawRow, b: RawRow) {
    try {
      const assetA = applyAliases(get(a, 'asset'));
      const assetB = applyAliases(get(b, 'asset'));
      const cashA = isCash(assetA);
      const cashB = isCash(assetB);

      let tradeRow: RawRow, cashRow: RawRow, tradeAsset: string;
      if (!cashA && cashB) {
        tradeRow = a; cashRow = b; tradeAsset = assetA;
      } else if (cashA && !cashB) {
        tradeRow = b; cashRow = a; tradeAsset = assetB;
      } else {
        // Both non-cash (cross-trade) or both cash: fall back to individual processing
        processRow(a); processRow(b); return;
      }

      skip(cashRow, 'CASH_LEG_SKIPPED', `Cash leg (${get(cashRow, 'asset')}) in Convert pair`);

      const rawQty = parseNumeric(get(tradeRow, 'quantity'));
      // Positive non-cash qty = receiving asset → BUY; negative = sending asset → SELL
      const type: TradeDirection = rawQty >= 0 ? 'BUY' : 'SELL';
      commitTrade(tradeRow, tradeAsset, type, rawQty, parseNumeric(get(tradeRow, 'price')), parseNumeric(get(tradeRow, 'fee')));
    } catch (err) {
      skipped.push({ rawRowIndex: a.rowIndex, code: 'PARSE_ERROR', message: String(err) });
    }
  }

  // ── Row dispatch ─────────────────────────────────────────────────────────────
  if (preset.rowModel === 'paired') {
    const groups = new Map<string, RawRow[]>();
    for (const row of rawRows) {
      const key =
        preset.legPairKey === 'refid' ? get(row, 'id') :
        preset.legPairKey === 'timestamp' ? get(row, 'timestamp') :
        String(row.rowIndex);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    for (const group of groups.values()) {
      if (group.length === 1) processRow(group[0]);
      else if (group.length === 2) processPair(group[0], group[1]);
      else group.forEach(processRow); // >2 legs: treat each individually
    }
  } else {
    rawRows.forEach(processRow);
  }

  return { trades, skipped, warnings };
}
