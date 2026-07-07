import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportModal } from './SupportModal';
import { supportApi } from '../services/api';

vi.mock('../services/api', () => ({
  supportApi: { submit: vi.fn() },
}));

// The Modal component uses showModal() imperatively, which in jsdom doesn't set the
// `open` attribute, making dialog content inert to ARIA queries. Use { hidden: true }
// to reach elements inside the closed-in-ARIA-terms dialog.
function q(name: RegExp) {
  return screen.getByRole('button', { name, hidden: true });
}

function renderModal(isOpen = true, onClose = vi.fn()) {
  return render(<SupportModal isOpen={isOpen} onClose={onClose} />);
}

describe('SupportModal', () => {
  beforeEach(() => {
    vi.mocked(supportApi.submit).mockReset();
  });

  it('renders the form fields when open', () => {
    renderModal();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(q(/send/i)).toBeInTheDocument();
  });

  it('disables Send while subject or message is empty', () => {
    renderModal();
    const send = q(/send/i);
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hello' } });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Test message' } });
    expect(send).not.toBeDisabled();
  });

  it('calls supportApi.submit with trimmed values and shows success', async () => {
    vi.mocked(supportApi.submit).mockResolvedValue(undefined);
    renderModal();

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: '  Help  ' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: '  Need assistance  ' } });
    fireEvent.click(q(/send/i));

    await waitFor(() => {
      expect(supportApi.submit).toHaveBeenCalledWith({ subject: 'Help', message: 'Need assistance' });
    });
    expect(screen.getByText(/message sent/i)).toBeInTheDocument();
  });

  it('shows an error message when the API call fails', async () => {
    vi.mocked(supportApi.submit).mockRejectedValue(new Error('Network error'));
    renderModal();

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Help' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Problem here' } });
    fireEvent.click(q(/send/i));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('resets form and calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i, hidden: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
