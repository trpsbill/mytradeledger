import { useState, useEffect, useRef } from 'react';
import { tokensApi } from '../../services/api';
import type { PersonalAccessToken, CreateTokenResponse } from '../../types';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function TokenRevealModal({
  token,
  onClose,
}: {
  token: CreateTokenResponse | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (token) {
      dialog.showModal();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCopied(false);
    } else {
      dialog.close();
    }
  }, [token]);

  function handleCopy() {
    if (!token) return;
    navigator.clipboard.writeText(token.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg">Your new API token</h3>
        <div className="py-4 space-y-4">
          <div className="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Copy this token now — it will <strong>never be shown again</strong>.</span>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Token: {token?.name}</span>
            </label>
            <div className="join w-full">
              <input
                type="text"
                readOnly
                value={token?.token ?? ''}
                className="input input-bordered join-item flex-1 font-mono text-sm"
                onFocus={(e) => e.target.select()}
              />
              <button className="btn join-item" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-action">
          <button className="btn btn-primary" onClick={onClose}>
            I've saved my token
          </button>
        </div>
      </div>
    </dialog>
  );
}

function RevokeDialog({
  token,
  onClose,
  onConfirm,
}: {
  token: PersonalAccessToken | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (token) dialog.showModal();
    else dialog.close();
  }, [token]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg">Revoke token?</h3>
        <div className="py-4">
          <p className="text-base-content/80">
            Revoke <strong>{token?.name}</strong> ({token?.tokenPrefix}...{token?.lastFourChars})?
            Any scripts using this token will immediately stop working.
          </p>
        </div>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-error" onClick={() => { onConfirm(); onClose(); }}>
            Revoke
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export function ApiTokensPage() {
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [revealToken, setRevealToken] = useState<CreateTokenResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PersonalAccessToken | null>(null);

  async function loadTokens() {
    try {
      setError(null);
      const resp = await tokensApi.list();
      setTokens(resp.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTokens(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const payload: { name: string; expiresAt?: string } = { name: name.trim() };
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
      const resp = await tokensApi.create(payload);
      setRevealToken(resp.data);
      setName('');
      setExpiresAt('');
      await loadTokens();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token: PersonalAccessToken) {
    try {
      await tokensApi.revoke(token.id);
      setTokens((prev) => prev.filter((t) => t.id !== token.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to revoke token');
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Tokens</h1>
        <p className="text-base-content/70 mt-1">
          Personal access tokens let you authenticate to the MyTradeLedger API without using your
          session. Treat them like passwords — store them securely.
        </p>
      </div>

      {/* Create token form */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Create new token</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="form-control flex-1">
                <label className="label">
                  <span className="label-text">Token name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. My trading script"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Expires (optional)</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            {createError && (
              <div className="alert alert-error text-sm">{createError}</div>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating || !name.trim()}
            >
              {creating ? <span className="loading loading-spinner loading-sm" /> : null}
              Generate token
            </button>
          </form>
        </div>
      </div>

      {/* Token list */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Active tokens</h2>
          {error && <div className="alert alert-error text-sm">{error}</div>}
          {loading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-base-content/60 py-4 text-sm">No tokens yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Token</th>
                    <th>Created</th>
                    <th>Last used</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium">{t.name}</td>
                      <td className="font-mono text-xs text-base-content/70">
                        {t.tokenPrefix}...{t.lastFourChars}
                      </td>
                      <td className="text-xs">{formatDate(t.createdAt)}</td>
                      <td className="text-xs">{formatDate(t.lastUsedAt)}</td>
                      <td className="text-xs">
                        {t.expiresAt ? (
                          new Date(t.expiresAt) < new Date() ? (
                            <span className="badge badge-error badge-sm">Expired</span>
                          ) : (
                            formatDate(t.expiresAt)
                          )
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => setRevokeTarget(t)}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TokenRevealModal token={revealToken} onClose={() => setRevealToken(null)} />
      <RevokeDialog
        token={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && handleRevoke(revokeTarget)}
      />
    </div>
  );
}
