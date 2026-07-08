import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LedgerPage } from './LedgerPage';
import { LedgerEntryForm } from './LedgerEntryForm';
import { useApi, useApiWithMeta } from '../../hooks';
import type { LedgerEntry, Account } from '../../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('./LedgerEntryForm', () => ({
  LedgerEntryForm: vi.fn(() => null),
}));

vi.mock('../../hooks', () => ({
  useApi: vi.fn(),
  useApiWithMeta: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  accountsApi: { list: vi.fn(), getPnL: vi.fn(), getBalance: vi.fn(), seedDemo: vi.fn() },
  ledgerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteBatch: vi.fn(), clearAll: vi.fn(), exportCsv: vi.fn() },
}));

const ACCOUNT: Account = {
  id: 'acc-1', name: 'Main', baseCurrency: 'USD',
  isDefault: true, isDemo: false, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};
const ACCOUNT_2: Account = {
  id: 'acc-2', name: 'Kraken', baseCurrency: 'USD',
  isDefault: false, isDemo: false, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};

const BUY: LedgerEntry = {
  id: 'e1', accountId: 'acc-1', timestamp: '2026-06-01T10:00:00.000Z',
  entryType: 'BUY', symbol: 'BTC', quantity: '0.5', price: '60000',
  fee: null, valueBase: '-30000', pnl: null, netPnl: null, pnlStatus: null,
  notes: null, createdAt: '2026-06-01T00:00:00Z', account: ACCOUNT,
};

const SELL_WITH_FEE_AND_NOTES: LedgerEntry = {
  id: 'e2', accountId: 'acc-1', timestamp: '2026-06-02T12:00:00.000Z',
  entryType: 'SELL', symbol: 'ETH', quantity: '-2', price: '3000',
  fee: '5.00', valueBase: '6000', pnl: '500', netPnl: '495', pnlStatus: null,
  notes: 'partial exit', createdAt: '2026-06-02T00:00:00Z', account: ACCOUNT,
};

const UNCOMPUTABLE_SELL: LedgerEntry = {
  ...SELL_WITH_FEE_AND_NOTES, id: 'e3', symbol: 'XRP',
  fee: null, notes: null, pnl: null, pnlStatus: 'PNL_UNCOMPUTABLE',
};

const noData = { data: null, loading: false, error: null, refetch: vi.fn() };

function setup(entries: LedgerEntry[] = [BUY, SELL_WITH_FEE_AND_NOTES]) {
  vi.mocked(useApiWithMeta).mockReturnValue({
    data: entries, loading: false, error: null, refetch: vi.fn(),
    meta: { total: entries.length, limit: 50, offset: 0 },
  });
  vi.mocked(useApi)
    .mockReturnValue(noData)
    .mockReturnValueOnce({ data: [ACCOUNT], loading: false, error: null, refetch: vi.fn() });
  return render(<MemoryRouter><LedgerPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LedgerPage — empty state', () => {
  it('shows "No ledger entries" when there are no entries', () => {
    setup([]);
    expect(screen.getByText('No ledger entries')).toBeInTheDocument();
  });

  it('shows "Add Entry" action in empty state', () => {
    setup([]);
    expect(screen.getByRole('button', { name: 'Add Entry' })).toBeInTheDocument();
  });
});

describe('LedgerPage — entry rendering (mobile cards + desktop table)', () => {
  it('renders both entry symbols in the document', () => {
    setup();
    expect(screen.getAllByText('BTC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ETH').length).toBeGreaterThan(0);
  });

  it('renders BUY and SELL badges', () => {
    setup();
    expect(screen.getAllByText('BUY').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SELL').length).toBeGreaterThan(0);
  });

  it('renders a desktop table with expected column headers', () => {
    const { container } = setup();
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Timestamp' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Symbol' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fee' })).toBeInTheDocument();
  });
});

describe('LedgerPage — mobile card layout', () => {
  it('renders the mobile card container (sm:hidden)', () => {
    const { container } = setup();
    const mobileList = container.querySelector('[class*="sm:hidden"]');
    expect(mobileList).toBeInTheDocument();
  });

  it('renders the desktop table wrapper (hidden sm:block)', () => {
    const { container } = setup();
    const desktopWrapper = container.querySelector('[class*="hidden sm:block"]');
    expect(desktopWrapper).toBeInTheDocument();
  });

  it('renders a "Select all" label unique to the mobile layout', () => {
    setup();
    expect(screen.getByText('Select all')).toBeInTheDocument();
  });

  it('shows fee line in mobile card when fee is set', () => {
    setup([SELL_WITH_FEE_AND_NOTES]);
    // "Fee:" prefix is unique to the mobile card — desktop shows fee in its own column
    expect(screen.getByText(/^Fee:/)).toBeInTheDocument();
  });

  it('does not show fee line in mobile card when fee is null', () => {
    setup([BUY]);
    expect(screen.queryByText(/^Fee:/)).not.toBeInTheDocument();
  });

  it('shows notes in mobile card when notes are set', () => {
    setup([SELL_WITH_FEE_AND_NOTES]);
    expect(screen.getAllByText('partial exit').length).toBeGreaterThan(0);
  });

  it('does not show notes text when entry has no notes', () => {
    setup([BUY]);
    expect(screen.queryByText('partial exit')).not.toBeInTheDocument();
  });

  it('renders qty @ price detail line in mobile cards', () => {
    setup();
    const atSeparators = screen.getAllByText(/@/);
    expect(atSeparators.length).toBeGreaterThan(0);
  });
});

describe('LedgerPage — P&L display', () => {
  it('shows formatted P&L for a SELL entry with pnl', () => {
    setup([SELL_WITH_FEE_AND_NOTES]);
    expect(screen.getAllByText('+500.00').length).toBeGreaterThan(0);
  });

  it('renders a warning indicator for uncomputable P&L (mobile card)', () => {
    setup([UNCOMPUTABLE_SELL]);
    expect(screen.getByTitle(/P&L can't be calculated/i)).toBeInTheDocument();
  });
});

describe('LedgerPage — checkbox selection', () => {
  it('renders checkboxes for each entry in both mobile and desktop views', () => {
    setup();
    // mobile: 1 select-all + 2 entry rows; desktop: 1 select-all + 2 entry rows = 6 total
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(6);
  });

  it('"Select all" checkbox selects all entries and shows bulk-delete button', () => {
    setup();
    // The mobile "Select all" checkbox is next to the "Select all" label
    const selectAllLabel = screen.getByText('Select all');
    const mobileSelectAll = selectAllLabel.closest('div')!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(mobileSelectAll);
    expect(screen.getByRole('button', { name: /delete 2 selected/i })).toBeInTheDocument();
  });

  it('clicking an individual mobile card checkbox marks that entry selected', () => {
    const { container } = setup();
    const mobileContainer = container.querySelector('[class*="sm:hidden"]')!;
    const [firstEntryCheckbox] = mobileContainer.querySelectorAll<HTMLInputElement>('.divide-y input[type="checkbox"]');
    expect(firstEntryCheckbox.checked).toBe(false);
    fireEvent.click(firstEntryCheckbox);
    expect(firstEntryCheckbox.checked).toBe(true);
  });
});

describe('LedgerPage — modal interactions', () => {
  it('clicking Edit opens the edit modal', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByText('Edit Ledger Entry')).toBeInTheDocument();
  });

  it('clicking Delete opens the confirm dialog', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getByText(/are you sure you want to delete this ledger entry/i)).toBeInTheDocument();
  });
});

describe('LedgerPage — New Entry account pre-selection', () => {
  function setupMultiAccount(initialEntry = '/') {
    vi.mocked(useApiWithMeta).mockReturnValue({
      data: [BUY], loading: false, error: null, refetch: vi.fn(),
      meta: { total: 1, limit: 50, offset: 0 },
    });
    vi.mocked(useApi)
      .mockReturnValue(noData)
      .mockReturnValueOnce({ data: [ACCOUNT, ACCOUNT_2], loading: false, error: null, refetch: vi.fn() });
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LedgerPage />
      </MemoryRouter>
    );
  }

  // LedgerPage always renders the New Entry form (not conditionally).
  // The call with no `entry` prop is the New Entry form instance.
  function newEntryFormProps() {
    const calls = vi.mocked(LedgerEntryForm).mock.calls;
    return calls.find(c => !c[0].entry)?.[0];
  }

  it('passes the active account filter as initialAccountId to the New Entry form', () => {
    setupMultiAccount('/?accountId=acc-2');
    expect(newEntryFormProps()?.initialAccountId).toBe('acc-2');
  });

  it('passes no initialAccountId when no account filter is active', () => {
    setupMultiAccount();
    expect(newEntryFormProps()?.initialAccountId).toBeUndefined();
  });

  it('passes accountsLoading=false to the form once accounts have loaded', () => {
    setupMultiAccount();
    expect(newEntryFormProps()?.accountsLoading).toBe(false);
  });
});

describe('LedgerPage — accountsLoading passed to form', () => {
  it('passes accountsLoading=true to the form while accounts are still loading', () => {
    vi.mocked(useApiWithMeta).mockReturnValue({
      data: [BUY], loading: false, error: null, refetch: vi.fn(),
      meta: { total: 1, limit: 50, offset: 0 },
    });
    // First useApi call = accounts (still loading), second = anything else
    vi.mocked(useApi)
      .mockReturnValue(noData)
      .mockReturnValueOnce({ data: null, loading: true, error: null, refetch: vi.fn() });

    render(
      <MemoryRouter>
        <LedgerPage />
      </MemoryRouter>
    );

    const calls = vi.mocked(LedgerEntryForm).mock.calls;
    const newEntryCall = calls.find(c => !c[0].entry)?.[0];
    expect(newEntryCall?.accountsLoading).toBe(true);
  });
});

describe('LedgerPage — no accounts state', () => {
  function setupNoAccounts() {
    vi.mocked(useApiWithMeta).mockReturnValue({
      data: [], loading: false, error: null, refetch: vi.fn(),
      meta: { total: 0, limit: 50, offset: 0 },
    });
    vi.mocked(useApi)
      .mockReturnValue(noData)
      .mockReturnValueOnce({ data: [], loading: false, error: null, refetch: vi.fn() });
    return render(<MemoryRouter><LedgerPage /></MemoryRouter>);
  }

  it('shows "No trading accounts yet" empty state title', () => {
    setupNoAccounts();
    expect(screen.getByText('No trading accounts yet')).toBeInTheDocument();
  });

  it('shows explanation text with exchange examples', () => {
    setupNoAccounts();
    expect(screen.getByText(/coinbase, kraken/i)).toBeInTheDocument();
  });

  it('all "Add Trading Account" buttons navigate to /accounts', () => {
    setupNoAccounts();
    const buttons = screen.getAllByRole('button', { name: 'Add Trading Account' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/app/accounts');
  });

  it('does not show the "New Entry" label when there are no trading accounts', () => {
    setupNoAccounts();
    expect(screen.queryByRole('button', { name: 'New Entry' })).not.toBeInTheDocument();
  });
});

