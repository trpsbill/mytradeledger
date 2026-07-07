import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DocsLayout } from './DocsLayout';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks', () => ({
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
    ...overrides,
  };
}

function renderDocsLayout(user: AuthReturn['user'] = null) {
  vi.mocked(useAuth).mockReturnValue(baseAuth({ user }));
  const router = createMemoryRouter(
    [{
      path: '/docs',
      element: <DocsLayout />,
      children: [{ index: true, element: <div>docs content</div> }],
    }],
    { initialEntries: ['/docs'] }
  );
  return render(<RouterProvider router={router} />);
}

describe('DocsLayout header', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(baseAuth());
  });

  it('shows Log In link and no app nav when not logged in', () => {
    renderDocsLayout(null);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('shows full app nav with user email and no Log In when logged in', () => {
    renderDocsLayout({ id: '1', email: 'user@example.com', emailVerified: true });
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
  });
});
