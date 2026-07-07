import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountsPage } from './AccountsPage';
import { useApi } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { Account } from '../../types';

vi.mock('../../hooks', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('../../services/api', () => ({
  accountsApi: {
    list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    setDefault: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), getPnL: vi.fn(),
  },
}));

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

const DEMO_ACCOUNT: Account = {
  id: 'demo-acc-1', name: 'Demo Portfolio', baseCurrency: 'USD',
  isDefault: false, isDemo: true, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};

function setup(accounts: Account[] = [DEMO_ACCOUNT]) {
  vi.mocked(useApi).mockReturnValue({ data: accounts, loading: false, error: null, refetch: vi.fn() });
  return render(<MemoryRouter><AccountsPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(baseAuth());
});

describe('AccountsPage — New Account for a real (non-demo) user', () => {
  it('does not show the demo upsell modal', () => {
    setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'New Account' }));
    expect(screen.queryByText(/not available in demo mode/i)).not.toBeInTheDocument();
  });
});

describe('AccountsPage — New Account for a demo user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: 'demo-1', email: 'demo-abc@demo.mytradeledger.local', isPaid: false, emailVerified: true, isDemo: true } })
    );
  });

  it('shows the demo upsell modal instead of the create-account form', () => {
    setup([DEMO_ACCOUNT]);
    fireEvent.click(screen.getByRole('button', { name: 'New Account' }));
    expect(screen.getByText(/not available in demo mode/i)).toBeInTheDocument();
    const link = screen.getByText(/start free trial/i).closest('a');
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('shows the demo upsell modal from the empty-state "Create Account" action too', () => {
    setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText(/not available in demo mode/i)).toBeInTheDocument();
  });
});
