import { useState } from 'react';
import { Modal } from './Modal';
import { supportApi } from '../services/api';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleClose() {
    if (status === 'submitting') return;
    setSubject('');
    setMessage('');
    setStatus('idle');
    setErrorMsg('');
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      await supportApi.submit({ subject: subject.trim(), message: message.trim() });
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Support">
      {status === 'success' ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">&#10003;</div>
          <p className="font-semibold mb-1">Message sent!</p>
          <p className="text-sm text-base-content/70 mb-4">
            We'll get back to you at the email on your account.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleClose}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label" htmlFor="support-subject">
              <span className="label-text">Subject</span>
            </label>
            <input
              id="support-subject"
              type="text"
              className="input input-bordered w-full"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              required
              disabled={status === 'submitting'}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="support-message">
              <span className="label-text">Message</span>
            </label>
            <textarea
              id="support-message"
              className="textarea textarea-bordered w-full"
              rows={5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={5000}
              required
              disabled={status === 'submitting'}
            />
          </div>
          {status === 'error' && (
            <p className="text-error text-sm">{errorMsg}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClose}
              disabled={status === 'submitting'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={status === 'submitting' || !subject.trim() || !message.trim()}
            >
              {status === 'submitting' ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Send
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
