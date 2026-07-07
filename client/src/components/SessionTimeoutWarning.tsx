import { useEffect, useState } from 'react';

interface Props {
  expiresAt: number; // ms since epoch
  onKeepAlive: () => Promise<void>;
  onLogout: () => void;
}

export function SessionTimeoutWarning({ expiresAt, onKeepAlive, onLogout }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  async function handleKeepAlive() {
    setLoading(true);
    try {
      await onKeepAlive();
    } finally {
      setLoading(false);
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <dialog open className="modal modal-open z-50">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Session Expiring Soon</h3>
        <p className="py-4">
          Your session will expire in{' '}
          <span className="font-mono font-bold text-warning">
            {minutes}:{seconds}
          </span>
          . Would you like to stay logged in?
        </p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onLogout} disabled={loading}>
            Log out
          </button>
          <button className="btn btn-primary" onClick={handleKeepAlive} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : 'Stay logged in'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
