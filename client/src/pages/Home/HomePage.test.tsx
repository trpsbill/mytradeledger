import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { useAuth } from '../../contexts/AuthContext';

const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('react-router-dom', async (importActual) => ({
  ...(await importActual<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));
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
    loginAsDemo: vi.fn(),
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

  it('renders the Treasoro copyright notice', () => {
    renderHomePage();
    expect(screen.getByText(/© 2026 Treasoro LLC\. All rights reserved\./i)).toBeInTheDocument();
  });

  it('renders Terms of Service link', () => {
    renderHomePage();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
  });

  it('renders Privacy Policy link', () => {
    renderHomePage();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('renders Cancellation Policy link', () => {
    renderHomePage();
    expect(screen.getByRole('link', { name: 'Cancellation Policy' })).toBeInTheDocument();
  });

  it('renders Terms of Service as an internal link to /terms', () => {
    renderHomePage();
    const link = screen.getByRole('link', { name: 'Terms of Service' });
    expect(link).toHaveAttribute('href', '/terms');
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('renders Privacy Policy as an internal link to /privacy', () => {
    renderHomePage();
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('renders Cancellation Policy as an internal link to /refund', () => {
    renderHomePage();
    const link = screen.getByRole('link', { name: 'Cancellation Policy' });
    expect(link).toHaveAttribute('href', '/refund');
    expect(link).not.toHaveAttribute('target', '_blank');
  });
});

describe('HomePage signup CTAs', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
  });

  it('renders Get Started nav CTA links pointing to the pricing section when signups are enabled', () => {
    renderHomePage();
    const ctaLinks = screen.getAllByRole('link', { name: 'Get Started' });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach(link => expect(link).toHaveAttribute('href', '#pricing'));
  });

  it('renders pricing card CTA links pointing to signup when signups are enabled', () => {
    renderHomePage();
    const pricingSection = screen.getByRole('region', { name: 'Pricing' });
    const ctaLinks = within(pricingSection).getAllByRole('link', { name: /^(start free|get started) →$/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach(link => expect(link).toHaveAttribute('href', '/signup'));
  });

  it('hides Get Started nav CTA links when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderHomePage();
    expect(screen.queryAllByRole('link', { name: 'Get Started' })).toHaveLength(0);
  });

  it('shows coming soon text when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderHomePage();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
  });
});

describe('HomePage — Try Live Demo CTA', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the Try Live Demo button in the hero when signups are enabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
    renderHomePage();
    expect(screen.getByRole('button', { name: /try live demo/i })).toBeInTheDocument();
  });

  it('hides the Try Live Demo button when signups are disabled', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ signupsEnabled: false }));
    renderHomePage();
    expect(screen.queryByRole('button', { name: /try live demo/i })).not.toBeInTheDocument();
  });

  it('starts a demo session and navigates to /app on click', async () => {
    const loginAsDemo = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(baseAuth({ loginAsDemo }));
    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: /try live demo/i }));

    await waitFor(() => expect(loginAsDemo).toHaveBeenCalledOnce());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app'));
  });

  it('re-enables the button and does not navigate if starting the demo fails', async () => {
    const loginAsDemo = vi.fn().mockRejectedValue(new Error('Too many demo sessions'));
    vi.mocked(useAuth).mockReturnValue(baseAuth({ loginAsDemo }));
    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: /try live demo/i }));

    await waitFor(() => expect(loginAsDemo).toHaveBeenCalledOnce());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /try live demo/i })).not.toBeDisabled();
  });
});
