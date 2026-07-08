import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { SupportModal } from './SupportModal';

const navItems = [
  { path: '/app', label: 'Dashboard' },
  { path: '/app/accounts', label: 'Accounts' },
  { path: '/app/ledger', label: 'Ledger' },
  { path: '/docs', label: 'Docs' },
];

function isNavActive(itemPath: string, currentPath: string): boolean {
  if (itemPath === '/app') return currentPath === '/app';
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
}

export function AppNavbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [mobileMenuOpen]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div ref={containerRef}>
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1 flex items-center gap-1">
          {/* Hamburger - mobile only */}
          <button
            className="btn btn-ghost btn-circle md:hidden"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <Link to="/app" className="btn btn-ghost text-xl gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-7 w-7">
              <rect width="100" height="100" rx="10" fill="#570df8"/>
              <text x="50" y="68" fontFamily="Arial, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">TL</text>
            </svg>
            MyTradeLedger
          </Link>
        </div>

        {/* Desktop nav links */}
        <div className="flex-none flex items-center gap-2">
          <ul className="hidden md:flex menu menu-horizontal px-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isNavActive(item.path, location.pathname) ? 'menu-active' : ''}
                  aria-current={isNavActive(item.path, location.pathname) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <button
            className="btn btn-ghost btn-circle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          {user ? (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-1">
                {/* Mobile: avatar circle with first letter */}
                <div className="md:hidden w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">
                  {(user.email?.[0] ?? '?').toUpperCase()}
                </div>
                {/* Desktop: email text */}
                <span className="hidden md:inline text-sm max-w-[140px] truncate">{user.email}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-10 w-48 p-2 shadow">
                <li>
                  <Link to="/app/settings/tokens">API Tokens</Link>
                </li>
                <li>
                  <button onClick={() => setSupportModalOpen(true)}>Support</button>
                </li>
                <li>
                  <button onClick={handleLogout} className="text-error">
                    Log out
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
          )}
        </div>
      </div>

      {/* Mobile nav menu - conditionally rendered */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-base-100 border-b border-base-300 shadow-md" aria-label="Mobile navigation">
          <ul className="menu px-4 py-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isNavActive(item.path, location.pathname) ? 'menu-active' : ''}
                  aria-current={isNavActive(item.path, location.pathname) ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} />
    </div>
  );
}
