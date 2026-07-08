import type { ImportPreset } from './types';

/**
 * Verified against real Coinbase retail CSV exports.
 * Header is preceded by a preamble; parser detects it by matching the first column ("ID").
 * "Convert" rows come in pairs sharing the same timestamp; the non-cash leg becomes the trade.
 */
export const coinbase_retail: ImportPreset = {
  id: 'coinbase_retail',
  label: 'Coinbase (Retail)',
  rowModel: 'paired',
  legPairKey: 'timestamp',
  directionMode: 'typeColumn',
  symbolMode: 'single',
  pairDelimiter: null,
  cashAssets: ['USD', 'USDC', 'USDT', 'DAI'],
  symbolAliases: {},
  columnMap: {
    id: 'ID',
    timestamp: 'Timestamp',
    type: 'Transaction Type',
    asset: 'Asset',
    quantity: 'Quantity Transacted',
    priceCurrency: 'Price Currency',
    price: 'Price at Transaction',
    subtotal: 'Subtotal',
    total: 'Total (inclusive of fees and/or spread)',
    fee: 'Fees and/or Spread',
    notes: 'Notes',
  },
  skipBlankAssetRows: true,
};

/**
 * UNVERIFIED — column headers below have NOT been confirmed against a real Binance export.
 * Confirm all columnMap values before shipping this preset.
 */
export const binance: ImportPreset = {
  id: 'binance',
  label: 'Binance',
  rowModel: 'single',
  legPairKey: null,
  directionMode: 'sideColumn',
  symbolMode: 'pair',
  pairDelimiter: null,
  cashAssets: ['USDT', 'USDC', 'USD', 'BUSD', 'DAI'],
  symbolAliases: { XXBT: 'BTC' },
  columnMap: {
    timestamp: 'Date(UTC)',    // UNVERIFIED: may be 'DateTime' or 'Time'
    pair: 'Pair',              // UNVERIFIED: may be 'Symbol'
    side: 'Side',              // UNVERIFIED
    price: 'Price',            // UNVERIFIED
    quantity: 'Executed',      // UNVERIFIED: quantity of base asset filled
    fee: 'Fee',                // UNVERIFIED
    total: 'Amount',           // UNVERIFIED: total in quote currency
  },
  skipBlankAssetRows: true,
};

/**
 * UNVERIFIED — column headers below have NOT been confirmed against a real Bybit Spot export.
 * Confirm all columnMap values before shipping this preset.
 */
export const bybit_spot: ImportPreset = {
  id: 'bybit_spot',
  label: 'Bybit Spot',
  rowModel: 'single',
  legPairKey: null,
  directionMode: 'sideColumn',
  symbolMode: 'pair',
  pairDelimiter: null,
  cashAssets: ['USDT', 'USDC', 'USD', 'BUSD', 'DAI'],
  symbolAliases: {},
  columnMap: {
    timestamp: 'Order Time',    // UNVERIFIED: may be 'Create Time' or 'Time'
    pair: 'Symbol',             // UNVERIFIED
    side: 'Side',               // UNVERIFIED
    price: 'Order Price',       // UNVERIFIED: may be 'Avg Price'
    quantity: 'Order Qty',      // UNVERIFIED: may be 'Filled Qty'
    fee: 'Trading Fee',         // UNVERIFIED
  },
  skipBlankAssetRows: true,
};

/**
 * UNVERIFIED — column headers below have NOT been confirmed against a real OKX Trading export.
 * Confirm all columnMap values before shipping this preset.
 */
export const okx_trading: ImportPreset = {
  id: 'okx_trading',
  label: 'OKX Trading',
  rowModel: 'single',
  legPairKey: null,
  directionMode: 'sideColumn',
  symbolMode: 'pair',
  pairDelimiter: null,
  cashAssets: ['USDT', 'USDC', 'USD', 'BUSD', 'DAI'],
  symbolAliases: {},
  columnMap: {
    timestamp: 'Time',              // UNVERIFIED
    pair: 'Instrument ID',          // UNVERIFIED: e.g. "ETH-USDT"
    side: 'Side',                   // UNVERIFIED: may be 'Trade side'
    price: 'Avg Fill Price',        // UNVERIFIED
    quantity: 'Filled',             // UNVERIFIED: quantity of base asset
    fee: 'Fee',                     // UNVERIFIED: may be negative (rebate) for maker
  },
  skipBlankAssetRows: true,
};

/**
 * UNVERIFIED — column headers below have NOT been confirmed against a real KuCoin Spot export.
 * KuCoin uses '-' as the pair delimiter (e.g. DOGE-USDT).
 * Confirm all columnMap values before shipping this preset.
 */
export const kucoin_spot: ImportPreset = {
  id: 'kucoin_spot',
  label: 'KuCoin Spot',
  rowModel: 'single',
  legPairKey: null,
  directionMode: 'sideColumn',
  symbolMode: 'pair',
  pairDelimiter: '-',
  cashAssets: ['USDT', 'USDC', 'USD', 'BUSD', 'DAI'],
  symbolAliases: {},
  columnMap: {
    timestamp: 'tradeCreatedAt',  // UNVERIFIED: may be 'orderCreatedAt' or 'Time'
    pair: 'symbol',               // UNVERIFIED
    side: 'side',                 // UNVERIFIED: "buy"/"sell" (lowercase)
    price: 'price',               // UNVERIFIED
    quantity: 'size',             // UNVERIFIED: base asset quantity
    fee: 'fee',                   // UNVERIFIED
  },
  skipBlankAssetRows: true,
};

/** Minimal generic preset — caller should override columnMap fields for their specific export. */
export const generic: ImportPreset = {
  id: 'generic',
  label: 'Generic CSV',
  rowModel: 'single',
  legPairKey: null,
  directionMode: 'sideColumn',
  symbolMode: 'single',
  pairDelimiter: null,
  cashAssets: ['USD', 'USDT', 'USDC'],
  symbolAliases: {},
  columnMap: {
    timestamp: 'Date',
    type: 'Type',
    side: 'Side',
    asset: 'Asset',
    quantity: 'Quantity',
    price: 'Price',
    fee: 'Fee',
  },
  skipBlankAssetRows: true,
};

export const PRESETS: Record<string, ImportPreset> = {
  coinbase_retail,
  binance,
  bybit_spot,
  okx_trading,
  kucoin_spot,
  generic,
};
