import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LedgerEntryForm } from './LedgerEntryForm';
import { useAuth } from '../../contexts/AuthContext';
import type { Account } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

type AuthReturn = ReturnType<typeof useAuth>;

function baseAuth(overrides: Partial<AuthReturn> = {}): AuthReturn {
  return {
    user: { id: '1', email: 'test@example.com', isPaid: false, emailVerified: true, isDemo: false },
    token: 'jwt',
    loading: false,
    sessionWarning: null,
    signupsEnabled: true,
    login: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    keepAlive: vi.fn(),
    logout: vi.fn(),
    loginAsDemo: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(baseAuth());
});

const COINBASE: Account = {
  id: 'acc-1', name: 'Coinbase', baseCurrency: 'USD',
  isDefault: true, isDemo: false, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};
const KRAKEN: Account = {
  id: 'acc-2', name: 'Kraken', baseCurrency: 'USD',
  isDefault: false, isDemo: false, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};
const DEMO: Account = {
  id: 'acc-demo', name: 'Demo', baseCurrency: 'USD',
  isDefault: false, isDemo: true, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};

const noop = vi.fn();

describe('LedgerEntryForm — account picker visibility', () => {
  it('shows account picker when user has one non-demo account', () => {
    render(<LedgerEntryForm accounts={[COINBASE]} onSubmit={noop} onCancel={noop} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Coinbase (default)')).toBeInTheDocument();
  });

  it('shows account picker when user has multiple non-demo accounts', () => {
    render(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} onSubmit={noop} onCancel={noop} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Coinbase (default)')).toBeInTheDocument();
    expect(screen.getByText('Kraken')).toBeInTheDocument();
  });

  it('hides account picker when there are no non-demo accounts', () => {
    render(<LedgerEntryForm accounts={[DEMO]} onSubmit={noop} onCancel={noop} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('hides account picker when accounts list is empty', () => {
    render(<LedgerEntryForm accounts={[]} onSubmit={noop} onCancel={noop} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('pre-selects the sole account when there is only one', () => {
    render(<LedgerEntryForm accounts={[COINBASE]} onSubmit={noop} onCancel={noop} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc-1');
  });
});

describe('LedgerEntryForm — anonymous demo user (isDemo account is their only account)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: 'demo-1', email: 'demo-abc@demo.mytradeledger.local', isPaid: false, emailVerified: true, isDemo: true } })
    );
  });

  it('shows and pre-selects the account picker when the only account is isDemo', () => {
    render(<LedgerEntryForm accounts={[DEMO]} onSubmit={noop} onCancel={noop} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc-demo');
  });
});

describe('LedgerEntryForm — initialAccountId (filter-aware pre-selection)', () => {
  it('pre-selects the account matching initialAccountId over the default account', () => {
    render(
      <LedgerEntryForm
        accounts={[COINBASE, KRAKEN]}
        initialAccountId="acc-2"
        onSubmit={noop}
        onCancel={noop}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc-2');
  });

  it('leaves selection empty when multiple accounts exist and no initialAccountId is provided', () => {
    render(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} onSubmit={noop} onCancel={noop} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});

describe('LedgerEntryForm — race condition: accounts arrive after mount', () => {
  it('auto-fills accountId when a single account arrives after mount', async () => {
    const { rerender } = render(
      <LedgerEntryForm accounts={[]} onSubmit={noop} onCancel={noop} />
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await act(async () => {
      rerender(<LedgerEntryForm accounts={[COINBASE]} onSubmit={noop} onCancel={noop} />);
    });

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('acc-1');
    });
  });

  it('does NOT auto-fill when multiple accounts arrive and no initialAccountId is set', async () => {
    const { rerender } = render(
      <LedgerEntryForm accounts={[]} onSubmit={noop} onCancel={noop} />
    );

    await act(async () => {
      rerender(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} onSubmit={noop} onCancel={noop} />);
    });

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('does not overwrite a user-selected accountId when accounts prop updates', async () => {
    const { rerender } = render(
      <LedgerEntryForm accounts={[COINBASE, KRAKEN]} initialAccountId="acc-1" onSubmit={noop} onCancel={noop} />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc-1');

    await act(async () => {
      rerender(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} initialAccountId="acc-1" onSubmit={noop} onCancel={noop} />);
    });
    expect(select.value).toBe('acc-1');
  });
});

describe('LedgerEntryForm — forced account selection', () => {
  it('starts with empty selection and placeholder when multiple accounts and no initialAccountId', () => {
    render(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} onSubmit={noop} onCancel={noop} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByText('Select account…')).toBeInTheDocument();
  });

  it('does not show placeholder once an account is pre-selected', () => {
    render(
      <LedgerEntryForm accounts={[COINBASE, KRAKEN]} initialAccountId="acc-2" onSubmit={noop} onCancel={noop} />
    );
    expect(screen.queryByText('Select account…')).not.toBeInTheDocument();
  });

  it('shows validation error and does not call onSubmit when no account is selected', () => {
    const onSubmit = vi.fn();
    const { container } = render(<LedgerEntryForm accounts={[COINBASE, KRAKEN]} onSubmit={onSubmit} onCancel={noop} />);

    // fireEvent.submit bypasses HTML5 native validation so our JS guard runs
    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByText('Please select an account')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LedgerEntryForm — accountsLoading state', () => {
  it('shows a disabled loading picker when accountsLoading=true and accounts is empty', () => {
    render(<LedgerEntryForm accounts={[]} accountsLoading onSubmit={noop} onCancel={noop} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(screen.getByText('Loading accounts…')).toBeInTheDocument();
  });

  it('shows loading picker even when accounts prop is empty', () => {
    render(<LedgerEntryForm accounts={[]} accountsLoading onSubmit={noop} onCancel={noop} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('blocks submission with a loading error when accountsLoading=true', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <LedgerEntryForm accounts={[]} accountsLoading onSubmit={onSubmit} onCancel={noop} />
    );
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText(/accounts are still loading/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders normal picker once accountsLoading switches to false', () => {
    const { rerender } = render(
      <LedgerEntryForm accounts={[]} accountsLoading onSubmit={noop} onCancel={noop} />
    );
    expect(screen.getByText('Loading accounts…')).toBeInTheDocument();

    rerender(<LedgerEntryForm accounts={[COINBASE]} accountsLoading={false} onSubmit={noop} onCancel={noop} />);
    expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox') as HTMLSelectElement).not.toBeDisabled();
  });
});
