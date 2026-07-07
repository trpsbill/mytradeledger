import { Link } from 'react-router-dom';
import { Modal } from './Modal';

interface DemoUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

/**
 * Shown when a demo user tries to use a feature that's blocked in demo mode
 * (e.g. CSV import), instead of letting them hit a 403 partway through the flow.
 */
export function DemoUpsellModal({ isOpen, onClose, feature }: DemoUpsellModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Not available in demo mode">
      <p className="mb-4">
        {feature} isn't available in demo mode. Start a free trial to unlock it — no card required.
      </p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Maybe later</button>
        <Link to="/signup" className="btn btn-primary" onClick={onClose}>
          Start free trial
        </Link>
      </div>
    </Modal>
  );
}
