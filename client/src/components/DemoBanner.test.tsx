import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DemoBanner } from './DemoBanner';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

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

function renderBanner() {
  return render(
    <MemoryRouter>
      <DemoBanner />
    </MemoryRouter>
  );
}

describe('DemoBanner', () => {
  it('renders nothing when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth({ user: null }));
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a real (non-demo) user', () => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: '1', email: 'user@example.com', isPaid: false, emailVerified: true, isDemo: false } })
    );
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the demo mode message and a signup link for a demo user', () => {
    vi.mocked(useAuth).mockReturnValue(
      baseAuth({ user: { id: 'demo-1', email: 'demo-abc@demo.mytradeledger.local', isPaid: false, emailVerified: true, isDemo: true } })
    );
    renderBanner();
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up free/i })).toHaveAttribute('href', '/signup');
  });
});
