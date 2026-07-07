import { useState, useEffect, useRef, useCallback } from 'react';
import type { JSX } from 'react';
import type { Account } from '../types';

// ─── Import API shapes ────────────────────────────────────────────────────────

interface ImportTrade {
  sourceRowId: string | null;
  timestamp: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string | null;
  rawRowIndex: number;
}

interface ImportWarning {
  rawRowIndex: number;
  code: string;
  message: string;
}

interface PreviewResult {
  willImport: ImportTrade[];
  duplicates: ImportTrade[];
  skipped: ImportWarning[];
  warnings: ImportWarning[];
  summary: {
    willImportCount: number;
    duplicateCount: number;
    skippedCount: number;
    missingFeeCount: number;
    hasMissingFees: boolean;
    freeImportCap: number | null;
    cappedCount: number;
  };
}

interface CommitResult {
  succeeded: boolean;
  importedCount: number;
  duplicatesSkipped: number;
  accountId: string;
  accountCreated: boolean;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Brand-colored SVG logos — inline so there are no external image dependencies
const EXCHANGE_LOGOS: Record<string, JSX.Element> = {
  coinbase_retail: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0052FF"/>
      <path d="M16 5C9.925 5 5 9.925 5 16s4.925 11 11 11 11-4.925 11-11S22.075 5 16 5zm0 16.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z" fill="white"/>
    </svg>
  ),
  binance: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#F3BA2F"/>
      <path d="M16 7l2.5 2.5-5.5 5.5-2.5-2.5L16 7zm-6 6l2.5 2.5-2.5 2.5L7.5 15.5 10 13zm12 0l2.5 2.5-2.5 2.5-2.5-2.5L22 13zm-6 4l2.5 2.5-5.5 5.5-2.5-2.5L16 17zm0-2l-2.5-2.5 2.5-2.5 2.5 2.5L16 15z" fill="#1C1C1C"/>
    </svg>
  ),
  bybit_spot: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#F7A600"/>
      <text x="16" y="22" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="sans-serif" fill="white">BY</text>
    </svg>
  ),
  okx_trading: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#000"/>
      <text x="16" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="sans-serif" fill="white">OKX</text>
    </svg>
  ),
  kucoin_spot: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#23AF91"/>
      <text x="16" y="22" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="sans-serif" fill="white">KC</text>
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#6B7280"/>
      <path d="M10 8h8l4 4v12H10V8zm8 0v4h4" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <path d="M13 16h6M13 19h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const PRESETS = [
  { id: 'coinbase_retail', label: 'Coinbase' },
  { id: 'binance',         label: 'Binance'  },
  { id: 'bybit_spot',      label: 'Bybit'    },
  { id: 'okx_trading',     label: 'OKX'      },
  { id: 'kucoin_spot',     label: 'KuCoin'   },
  { id: 'generic',         label: 'Other'    },
] as const;

type PresetId = (typeof PRESETS)[number]['id'];
const PRESET_LABEL: Record<PresetId, string> = Object.fromEntries(
  PRESETS.map(p => [p.id, p.label])
) as Record<PresetId, string>;

const NEW_ACCOUNT = '__new__';
const TOKEN_KEY   = 'mtl_token';

const GENERIC_FIELDS = [
  { key: 'timestamp', label: 'Timestamp column',                required: true  },
  { key: 'asset',     label: 'Symbol column',                   required: true  },
  { key: 'side',      label: 'Side column (BUY / SELL values)', required: true  },
  { key: 'quantity',  label: 'Quantity column',                 required: true  },
  { key: 'price',     label: 'Price column',                    required: true  },
  { key: 'fee',       label: 'Fee column (optional)',           required: false },
] as const;

// ─── Multipart API helper (cannot reuse request() — it forces JSON content-type)

async function importPost<T>(path: string, fd: FormData): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api/import${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[] | null;
  onImportComplete: () => void;
}

export function ImportCsvModal({ isOpen, onClose, accounts, onImportComplete }: ImportCsvModalProps) {
  const dialogRef    = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step,           setStep]          = useState<1 | 2 | 3 | 4>(1);
  const [presetId,       setPresetId]      = useState<PresetId | ''>('');
  const [accountSel,     setAccountSel]    = useState('');
  const [newAcctName,    setNewAcctName]   = useState('');
  const [csvFile,        setCsvFile]       = useState<File | null>(null);
  const [dragOver,       setDragOver]      = useState(false);
  const [colMap,         setColMap]        = useState<Record<string, string>>({});
  const [preview,        setPreview]       = useState<PreviewResult | null>(null);
  const [skippedOpen,    setSkippedOpen]   = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError,   setPreviewError]  = useState<string | null>(null);
  const [commitLoading,  setCommitLoading] = useState(false);
  const [commitResult,   setCommitResult]  = useState<CommitResult | null>(null);
  const [commitError,    setCommitError]   = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen) d.showModal(); else d.close();
  }, [isOpen]);

  const reset = useCallback(() => {
    setStep(1); setPresetId(''); setAccountSel(''); setNewAcctName('');
    setCsvFile(null); setDragOver(false); setColMap({});
    setPreview(null); setSkippedOpen(false);
    setPreviewLoading(false); setPreviewError(null);
    setCommitLoading(false); setCommitResult(null); setCommitError(null);
  }, []);

  useEffect(() => { if (!isOpen) reset(); }, [isOpen, reset]);

  // Resolved account name used in API calls and display
  const accountName =
    accountSel === NEW_ACCOUNT
      ? newAcctName.trim()
      : (accounts?.find(a => a.id === accountSel)?.name ?? '');

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handlePresetSelect(id: PresetId) {
    setPresetId(id);
    setNewAcctName(PRESET_LABEL[id]);
  }

  function goToStep2() {
    if (!accountSel) {
      setAccountSel(accounts && accounts.length > 0 ? accounts[0].id : NEW_ACCOUNT);
    }
    setStep(2);
  }

  function acceptFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) return;
    setCsvFile(file);
  }

  async function handlePreview() {
    if (!csvFile || !presetId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      fd.append('presetId', presetId);
      if (presetId === 'generic') fd.append('columnMap', JSON.stringify(colMap));
      const data = await importPost<PreviewResult>('/preview', fd);
      setPreview(data);
      setStep(3);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!csvFile || !presetId || !accountName) return;
    setCommitLoading(true);
    setCommitError(null);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      fd.append('presetId', presetId);
      fd.append('accountName', accountName);
      if (presetId === 'generic') fd.append('columnMap', JSON.stringify(colMap));
      const result = await importPost<CommitResult>('/commit', fd);
      setCommitResult(result);
      setStep(4);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Import failed');
      setStep(4);
    } finally {
      setCommitLoading(false);
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const genericOk =
    presetId !== 'generic' ||
    GENERIC_FIELDS.filter(f => f.required).every(f => (colMap[f.key] ?? '').trim());

  const canPreview = !!csvFile && !!accountName && genericOk;

  // ── Step renders ────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        <p className="text-base-content/70 text-sm">Select your exchange</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`btn btn-outline h-auto py-3 flex-col gap-2${presetId === p.id ? ' btn-primary' : ''}`}
              onClick={() => handlePresetSelect(p.id)}
            >
              {EXCHANGE_LOGOS[p.id]}
              <span className="text-xs font-medium">{p.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <button className="btn btn-primary" disabled={!presetId} onClick={goToStep2}>
            Next
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Import into account</span>
          </label>
          <select
            className="select select-bordered select-sm w-full"
            value={accountSel}
            onChange={e => setAccountSel(e.target.value)}
          >
            {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value={NEW_ACCOUNT}>+ Create new account</option>
          </select>
        </div>

        {accountSel === NEW_ACCOUNT && (
          <div className="form-control w-full">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder="Account name"
              maxLength={100}
              value={newAcctName}
              onChange={e => setNewAcctName(e.target.value)}
            />
          </div>
        )}

        {/* Drag-and-drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'}
            ${csvFile ? 'border-success bg-success/5' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files[0]; if (f) acceptFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
          />
          {csvFile ? (
            <>
              <div className="text-2xl mb-1">✓</div>
              <div className="text-sm font-medium text-success">{csvFile.name}</div>
              <div className="text-xs text-base-content/50 mt-1">Click to replace</div>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1">📁</div>
              <div className="text-sm">Drag & drop your .csv file here</div>
              <div className="text-xs text-base-content/50 mt-1">or click to browse</div>
            </>
          )}
        </div>

        {/* Generic column mapping */}
        {presetId === 'generic' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Map your CSV columns</p>
            {GENERIC_FIELDS.map(f => (
              <div key={f.key} className="form-control w-full">
                <label className="label py-0">
                  <span className="label-text text-xs">{f.label}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered input-xs w-full"
                  placeholder={f.required ? 'Required' : 'Optional'}
                  value={colMap[f.key] ?? ''}
                  onChange={e => setColMap(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {previewError && (
          <div className="alert alert-error py-2 text-sm"><span>{previewError}</span></div>
        )}

        <div className="flex justify-between pt-2">
          <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
          <button
            className="btn btn-primary"
            disabled={!canPreview || previewLoading}
            onClick={handlePreview}
          >
            {previewLoading && <span className="loading loading-spinner loading-xs" />}
            {previewLoading ? 'Previewing…' : 'Preview'}
          </button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    if (!preview) return null;
    const n = preview.summary.willImportCount;
    return (
      <div className="space-y-3">
        <div className="text-sm space-y-0.5">
          <p>
            <span className="font-semibold text-success">{n}</span>
            {' trade'}{n !== 1 ? 's' : ''} will be imported into{' '}
            <span className="font-semibold">{accountName}</span>
          </p>
          {preview.summary.duplicateCount > 0 && (
            <p className="text-base-content/60">
              {preview.summary.duplicateCount} duplicate{preview.summary.duplicateCount !== 1 ? 's' : ''} skipped
            </p>
          )}
          {preview.summary.skippedCount > 0 && (
            <p className="text-base-content/60">
              {preview.summary.skippedCount} row{preview.summary.skippedCount !== 1 ? 's' : ''} skipped
            </p>
          )}
        </div>

        {preview.summary.cappedCount > 0 && (
          <div className="alert alert-warning py-2 text-sm">
            <span>
              Free plan: only {preview.summary.freeImportCap} trade{preview.summary.freeImportCap !== 1 ? 's' : ''} can be imported ({preview.summary.cappedCount} trimmed from your file). Upgrade to Pro to import all of them.
            </span>
          </div>
        )}

        {preview.summary.hasMissingFees && (
          <div className="alert alert-warning py-2 text-sm">
            <span>⚠ Some trades have no fee recorded — net P&L may be slightly overstated.</span>
          </div>
        )}

        {preview.willImport.length > 0 && (
          <div className="overflow-y-auto min-h-[160px] max-h-80 border border-base-200 rounded">
            <table className="table table-xs">
              <thead className="sticky top-0 bg-base-100">
                <tr>
                  <th>Date</th><th>Type</th><th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Fee</th>
                </tr>
              </thead>
              <tbody>
                {preview.willImport.map((t, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{new Date(t.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <span className={`badge badge-xs ${t.type === 'BUY' ? 'badge-success' : 'badge-error'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="font-mono">{t.symbol}</td>
                    <td className="text-right font-mono">
                      {Math.abs(Number(t.quantity)).toFixed(8).replace(/\.?0+$/, '')}
                    </td>
                    <td className="text-right font-mono">
                      {Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="text-right font-mono">{t.fee > 0 ? Number(t.fee).toFixed(4) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.skipped.length > 0 && (
          <div className="border border-base-200 rounded-lg overflow-hidden">
            <button
              className="w-full text-left px-3 py-2 text-sm font-medium flex justify-between items-center hover:bg-base-200"
              onClick={() => setSkippedOpen(o => !o)}
            >
              <span>Skipped rows ({preview.skipped.length})</span>
              <span className="text-xs">{skippedOpen ? '▲' : '▼'}</span>
            </button>
            {skippedOpen && (
              <div className="border-t border-base-200 max-h-28 overflow-y-auto divide-y divide-base-200">
                {preview.skipped.map((w, i) => (
                  <div key={i} className="px-3 py-1 text-xs text-base-content/60 flex gap-2 items-start">
                    <span className="font-mono text-base-content/40 shrink-0">#{w.rawRowIndex}</span>
                    <span className="badge badge-ghost badge-xs shrink-0">{w.code}</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
          <button
            className="btn btn-primary"
            disabled={commitLoading || n === 0}
            onClick={handleCommit}
          >
            {commitLoading && <span className="loading loading-spinner loading-xs" />}
            {commitLoading ? 'Importing…' : `Import ${n} trade${n !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    if (commitError) {
      return (
        <div className="space-y-4 text-center py-4">
          <div className="text-4xl">❌</div>
          <p className="text-error font-medium">{commitError}</p>
          <button className="btn btn-ghost" onClick={() => { setCommitError(null); setStep(3); }}>
            Back
          </button>
        </div>
      );
    }
    if (!commitResult) return null;
    return (
      <div className="space-y-3 text-center py-4">
        <div className="text-4xl">✅</div>
        <p className="text-lg font-medium">
          {commitResult.importedCount} trade{commitResult.importedCount !== 1 ? 's' : ''} imported into{' '}
          <span className="font-bold">{accountName}</span>
        </p>
        {commitResult.accountCreated && (
          <p className="text-sm text-base-content/60">(new account created)</p>
        )}
        {commitResult.duplicatesSkipped > 0 && (
          <p className="text-sm text-base-content/60">
            {commitResult.duplicatesSkipped} duplicate{commitResult.duplicatesSkipped !== 1 ? 's' : ''} skipped
          </p>
        )}
        <button className="btn btn-primary" onClick={() => { onImportComplete(); onClose(); }}>
          Done
        </button>
      </div>
    );
  }

  const stepRenders = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box w-11/12 max-w-2xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 className="font-bold text-lg">Import CSV</h3>

        {/* Step progress bar */}
        <div className="flex items-center gap-1 mt-2 mb-4">
          {([1, 2, 3, 4] as const).map(s => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-base-300'}`}
            />
          ))}
          <span className="text-xs text-base-content/50 ml-2 whitespace-nowrap">Step {step}/4</span>
        </div>

        {stepRenders[step]()}
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  );
}
