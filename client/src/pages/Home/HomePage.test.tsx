import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks', () => ({
  useTheme: vi.fn(() => ({ theme: 'dark', toggleTheme: vi.fn() })),
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
    ...overrides,
  };
}

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage footer', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
  });

  it('renders the copyright notice', () => {
    renderHomePage();
    expect(screen.getByText(/© 2026 Treasoro LLC\. All rights reserved\./i)).toBeInTheDocument();
  });

  it('does not render a Terms of Service, Privacy Policy, or Cancellation Policy link', () => {
    renderHomePage();
    expect(screen.queryByRole('link', { name: 'Terms of Service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cancellation Policy' })).not.toBeInTheDocument();
  });
});

describe('HomePage signup CTAs', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
  });

  it('renders Get Started CTA links pointing to /signup when signups are enabled', () => {
    renderHomePage();
    const ctaLinks = screen.getAllByRole('link', { name: /get started/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach(link => expect(link).toHaveAttribute('href', '/signup'));
  });

  it('hides Get Started CTA links when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderHomePage();
    expect(screen.queryAllByRole('link', { name: /get started/i })).toHaveLength(0);
  });

  it('shows coming soon text when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderHomePage();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
  });

  it('does not render a Try Live Demo button', () => {
    renderHomePage();
    expect(screen.queryByRole('button', { name: /try live demo/i })).not.toBeInTheDocument();
  });
});
