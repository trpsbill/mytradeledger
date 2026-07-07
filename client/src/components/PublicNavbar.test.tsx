import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
  useApi: vi.fn(),
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
    loginAsDemo: vi.fn(),
    ...overrides,
  };
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <PublicNavbar />
    </MemoryRouter>
  );
}

describe('PublicNavbar', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
  });

  it('renders Docs link pointing to /docs', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  });

  it('renders GitHub link as external anchor', () => {
    renderNavbar();
    const github = screen.getByRole('link', { name: 'GitHub' });
    expect(github).toHaveAttribute('href', 'https://github.com/trpsbill/mytradeledger');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Log In link pointing to /login', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login');
  });

  it('renders Start Tracking CTA pointing to /signup when signups enabled', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Start Tracking' })).toHaveAttribute('href', '/signup');
  });

  it('hides Start Tracking CTA when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderNavbar();
    expect(screen.queryByRole('link', { name: 'Start Tracking' })).not.toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });
});
