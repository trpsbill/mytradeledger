import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountsPage } from './AccountsPage';
import { useApi } from '../../hooks';
import type { Account } from '../../types';

vi.mock('../../hooks', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  accountsApi: {
    list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    setDefault: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), getPnL: vi.fn(),
  },
}));

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
});

describe('AccountsPage — New Account', () => {
  it('opens the create-account form when "New Account" is clicked', () => {
    setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'New Account' }));
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('opens the create-account form from the empty-state "Create Account" action too', () => {
    setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
  });
});
