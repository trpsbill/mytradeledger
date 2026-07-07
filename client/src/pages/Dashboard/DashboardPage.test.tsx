import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { useApi, useApiWithMeta } from '../../hooks';
import type { LedgerEntry, Account } from '../../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks', () => ({
  useApi: vi.fn(),
  useApiWithMeta: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  accountsApi: { list: vi.fn(), getPnL: vi.fn(), getBalance: vi.fn(), seedDemo: vi.fn() },
  ledgerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), exportCsv: vi.fn() },
}));

const ACCOUNT: Account = {
  id: 'acc-1', name: 'Main', baseCurrency: 'USD',
  isDefault: true, isDemo: false, createdAt: '2026-01-01T00:00:00Z', archivedAt: null,
};

const BUY: LedgerEntry = {
  id: 'e1', accountId: 'acc-1', timestamp: '2026-06-01T10:00:00.000Z',
  entryType: 'BUY', symbol: 'BTC', quantity: '0.5', price: '60000',
  fee: null, valueBase: '-30000', pnl: null, netPnl: null, pnlStatus: null,
  notes: null, createdAt: '2026-06-01T00:00:00Z', account: ACCOUNT,
};

const SELL: LedgerEntry = {
  id: 'e2', accountId: 'acc-1', timestamp: '2026-06-02T12:00:00.000Z',
  entryType: 'SELL', symbol: 'ETH', quantity: '-2', price: '3000',
  fee: '5.00', valueBase: '6000', pnl: '500', netPnl: '495', pnlStatus: null,
  notes: null, createdAt: '2026-06-02T00:00:00Z', account: ACCOUNT,
};

const UNCOMPUTABLE_SELL: LedgerEntry = {
  ...SELL, id: 'e3', symbol: 'XRP', fee: null, pnl: null, pnlStatus: 'PNL_UNCOMPUTABLE',
};

const noData = { data: null, loading: false, error: null, refetch: vi.fn() };

function setup(entries: LedgerEntry[] = [BUY, SELL]) {
  vi.mocked(useApi)
    .mockReturnValue(noData)
    .mockReturnValueOnce({ data: [ACCOUNT], loading: false, error: null, refetch: vi.fn() });
  vi.mocked(useApiWithMeta).mockReturnValue({
    data: entries, loading: false, error: null, refetch: vi.fn(),
    meta: { total: entries.length, limit: 50, offset: 0 },
  });
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage — empty state (has trading account, no entries)', () => {
  it('shows welcome message when there are no entries', () => {
    setup([]);
    expect(screen.getByText('Welcome to MyTradeLedger')).toBeInTheDocument();
  });

  it('shows "Add Your First Trade" button when account exists but no entries', () => {
    setup([]);
    expect(screen.getByRole('button', { name: /add your first trade/i })).toBeInTheDocument();
  });
});

describe('DashboardPage — no trading accounts state', () => {
  function setupNoAccounts() {
    vi.mocked(useApi)
      .mockReturnValue(noData)
      .mockReturnValueOnce({ data: [], loading: false, error: null, refetch: vi.fn() });
    vi.mocked(useApiWithMeta).mockReturnValue({
      data: [], loading: false, error: null, refetch: vi.fn(),
      meta: { total: 0, limit: 50, offset: 0 },
    });
    return render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  }

  it('shows welcome message', () => {
    setupNoAccounts();
    expect(screen.getByText('Welcome to MyTradeLedger')).toBeInTheDocument();
  });

  it('explains they need a trading account with examples', () => {
    setupNoAccounts();
    expect(screen.getByText(/coinbase, kraken/i)).toBeInTheDocument();
  });

  it('"Add Trading Account" in welcome card navigates to /accounts', () => {
    setupNoAccounts();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Trading Account' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/app/accounts');
  });

  it('does not show "Add Your First Trade" when there are no trading accounts', () => {
    setupNoAccounts();
    expect(screen.queryByRole('button', { name: /add your first trade/i })).not.toBeInTheDocument();
  });

  it('header button also navigates to /accounts instead of opening the modal', () => {
    setupNoAccounts();
    const buttons = screen.getAllByRole('button', { name: 'Add Trading Account' });
    buttons.forEach(btn => fireEvent.click(btn));
    expect(mockNavigate).toHaveBeenCalledWith('/app/accounts');
  });
});

describe('DashboardPage — entry rendering (mobile cards + desktop table)', () => {
  it('renders both entry symbols in the document', () => {
    setup();
    expect(screen.getAllByText('BTC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ETH').length).toBeGreaterThan(0);
  });

  it('renders BUY badges for buy entries', () => {
    setup();
    const buyBadges = screen.getAllByText('BUY');
    expect(buyBadges.length).toBeGreaterThan(0);
  });

  it('renders SELL badges for sell entries', () => {
    setup();
    const sellBadges = screen.getAllByText('SELL');
    expect(sellBadges.length).toBeGreaterThan(0);
  });

  it('applies text-error class to negative total value (BUY entry)', () => {
    const { container } = setup();
    const errorSpans = container.querySelectorAll('.text-error');
    expect(errorSpans.length).toBeGreaterThan(0);
  });

  it('applies text-success class to positive total value (SELL entry)', () => {
    const { container } = setup();
    const successSpans = container.querySelectorAll('.text-success');
    expect(successSpans.length).toBeGreaterThan(0);
  });

  it('renders formatted P&L for a SELL entry with pnl', () => {
    setup();
    const pnlValues = screen.getAllByText('+500.00');
    expect(pnlValues.length).toBeGreaterThan(0);
  });

  it('renders a warning indicator for uncomputable P&L', () => {
    setup([UNCOMPUTABLE_SELL]);
    expect(screen.getByTitle(/P&L can't be calculated/i)).toBeInTheDocument();
  });

  it('renders Edit buttons for each entry (mobile card + desktop table)', () => {
    setup();
    // 2 entries × 2 views (mobile card + desktop row) = 4 Edit buttons
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(4);
  });

  it('renders Delete buttons for each entry (mobile card + desktop table)', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(4);
  });
});

describe('DashboardPage — mobile card layout', () => {
  it('renders a mobile card list container (sm:hidden)', () => {
    const { container } = setup();
    const mobileList = container.querySelector('[class*="sm:hidden"]');
    expect(mobileList).toBeInTheDocument();
  });

  it('renders a desktop table (hidden sm:block)', () => {
    const { container } = setup();
    const desktopTable = container.querySelector('[class*="hidden sm:block"]');
    expect(desktopTable).toBeInTheDocument();
    expect(desktopTable?.querySelector('table')).toBeInTheDocument();
  });

  it('mobile cards show qty @ price detail line', () => {
    setup();
    // "0.5 @ 60,000" or similar — just verify the @ separator appears in a card
    const atSeparators = screen.getAllByText(/@/);
    expect(atSeparators.length).toBeGreaterThan(0);
  });
});

describe('DashboardPage — modal interactions', () => {
  it('clicking an Edit button opens the edit modal', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByText('Edit Entry')).toBeInTheDocument();
  });

  it('clicking a Delete button opens the confirm dialog', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getByText(/are you sure you want to delete this entry/i)).toBeInTheDocument();
  });
});

