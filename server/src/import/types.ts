export type TradeDirection = 'BUY' | 'SELL';

export interface NormalizedTrade {
  sourceRowId: string | null;
  timestamp: Date;
  symbol: string;
  type: TradeDirection;
  /** Positive magnitude — the writer applies the sign based on `type` */
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string | null;
  rawRowIndex: number;
}

export type ParseWarningCode =
  | 'MISSING_FEE'
  | 'UNRESOLVED_DIRECTION'
  | 'CASH_LEG_SKIPPED'
  | 'NON_TRADE_SKIPPED'
  | 'UNPAIRED_LEG'
  | 'PARSE_ERROR';

export interface ParseWarning {
  rawRowIndex: number;
  code: ParseWarningCode;
  message: string;
}

export interface ParseResult {
  trades: NormalizedTrade[];
  skipped: ParseWarning[];
  warnings: ParseWarning[];
}

export interface ImportPreset {
  id: string;
  label: string;
  rowModel: 'single' | 'paired';
  legPairKey: 'refid' | 'timestamp' | null;
  directionMode: 'typeColumn' | 'amountSign' | 'sideColumn';
  symbolMode: 'single' | 'pair';
  pairDelimiter: string | null;
  cashAssets: string[];
  symbolAliases: Record<string, string>;
  /** Maps internal canonical keys (id, timestamp, type, asset, quantity, price, fee, side, pair) to CSV header strings */
  columnMap: Record<string, string>;
  skipBlankAssetRows: boolean;
}
