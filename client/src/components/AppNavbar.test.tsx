import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppNavbar } from './AppNavbar';
import { useAuth } from '../contexts/AuthContext';

const mockNavigate = vi.fn();

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
  useApi: vi.fn(),
}));
vi.mock('../services/api', () => ({
  supportApi: { submit: vi.fn() },
}));
vi.mock('react-router-dom', async (importActual) => ({
  ...(await importActual<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

type AuthReturn = ReturnType<typeof useAuth>;

function baseAuth(overrides: Partial<AuthReturn> = {}): AuthReturn {
  return {
    user: null,
    token: null,
    loading: false,
    sessionWarning: null,
    signupsEnabled: true,
    login: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    keepAlive: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

function renderNavbar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppNavbar />
    </MemoryRouter>
  );
}

describe('AppNavbar', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
    mockNavigate.mockReset();
  });

  it('shows Log In link and no user dropdown when not logged in', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('shows user email, nav links, and no Log In when logged in', () => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: '1', email: 'test@example.com', emailVerified: true } })
    );
    renderNavbar();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
  });

  it('shows the API Tokens and Support menu items when logged in', () => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: '1', email: 'test@example.com', emailVerified: true } })
    );
    renderNavbar();
    expect(screen.getByRole('link', { name: 'API Tokens' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /support/i })).toBeInTheDocument();
  });

  describe('active nav highlighting', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        baseAuth({ user: { id: '1', email: 'test@example.com', emailVerified: true } })
      );
    });

    it('marks Dashboard active at /app', () => {
      renderNavbar('/app');
      const dashLink = screen.getAllByRole('link', { name: 'Dashboard' })[0];
      expect(dashLink).toHaveClass('menu-active');
      expect(dashLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark Dashboard active on /app/accounts', () => {
      renderNavbar('/app/accounts');
      const dashLink = screen.getAllByRole('link', { name: 'Dashboard' })[0];
      expect(dashLink).not.toHaveClass('menu-active');
    });

    it('marks Accounts active at /app/accounts', () => {
      renderNavbar('/app/accounts');
      const link = screen.getAllByRole('link', { name: 'Accounts' })[0];
      expect(link).toHaveClass('menu-active');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('marks Ledger active at /app/ledger', () => {
      renderNavbar('/app/ledger');
      const link = screen.getAllByRole('link', { name: 'Ledger' })[0];
      expect(link).toHaveClass('menu-active');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('marks Docs active at /docs/overview', () => {
      renderNavbar('/docs/overview');
      const link = screen.getAllByRole('link', { name: 'Docs' })[0];
      expect(link).toHaveClass('menu-active');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('marks no item active on unrelated path', () => {
      renderNavbar('/login');
      const activeLinks = document.querySelectorAll('a.menu-active');
      expect(activeLinks.length).toBe(0);
    });
  });

  it('opens the support modal when Support is clicked', () => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: '1', email: 'test@example.com', emailVerified: true } })
    );
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });

  it('calls logout() and navigates to / when Log out is clicked', () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: '1', email: 'test@example.com', emailVerified: true }, logout })
    );
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(logout).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
