import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppNavbar } from './AppNavbar';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';

export function Layout() {
  const { logout, sessionWarning, keepAlive } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-base-200">
      <AppNavbar />
      <EmailVerificationBanner />
      <main className="container mx-auto px-3 py-4 sm:px-4">
        <Outlet />
      </main>
      {sessionWarning && (
        <SessionTimeoutWarning
          expiresAt={sessionWarning.expiresAt}
          onKeepAlive={keepAlive}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
