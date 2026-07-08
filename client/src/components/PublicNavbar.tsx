import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks';

const GITHUB_URL = 'https://github.com/trpsbill/mytradeledger';

const navLinks = [
  { label: 'Docs',   to: '/docs',     external: false },
  { label: 'GitHub', to: GITHUB_URL,  external: true  },
  { label: 'Log In', to: '/login',    external: false },
];

export function PublicNavbar() {
  const { signupsEnabled } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMobileOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [mobileOpen]);

  return (
    <header ref={containerRef} className="sticky top-0 z-50 bg-base-100 border-b border-base-300 shadow-sm shrink-0">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
            <rect width="100" height="100" rx="10" fill="#570df8"/>
            <text x="50" y="68" fontFamily="Arial, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">TL</text>
          </svg>
          <span className="hidden sm:inline">MyTradeLedger</span>
        </Link>

        <div className="flex-1" />

        <nav className="hidden md:flex items-center gap-1" aria-label="Public navigation">
          {navLinks.map(({ label, to, external }) =>
            external ? (
              <a
                key={label}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                {label}
              </a>
            ) : (
              <Link key={label} to={to} className="btn btn-ghost btn-sm">
                {label}
              </Link>
            )
          )}
        </nav>

        <button
          className="btn btn-ghost btn-circle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {signupsEnabled && (
          <Link to="/signup" className="hidden md:inline-flex btn btn-primary btn-sm">
            Start Tracking
          </Link>
        )}

        {/* Mobile hamburger */}
        <button
          className="md:hidden btn btn-ghost btn-circle"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-base-300 px-4 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
          {navLinks.map(({ label, to, external }) =>
            external ? (
              <a
                key={label}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm justify-start"
              >
                {label}
              </a>
            ) : (
              <Link key={label} to={to} className="btn btn-ghost btn-sm justify-start" onClick={() => setMobileOpen(false)}>
                {label}
              </Link>
            )
          )}
          {signupsEnabled && (
            <Link
              to="/signup"
              className="btn btn-primary btn-sm mt-2"
              onClick={() => setMobileOpen(false)}
            >
              Start Tracking
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
