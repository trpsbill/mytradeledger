import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AppNavbar } from '../../components/AppNavbar';
import { PublicNavbar } from '../../components/PublicNavbar';
import { NAV } from './nav';

// TODO: add descriptions for pages beyond the first three
const PAGE_META: Record<string, { title: string; description?: string }> = {
  overview: {
    title: 'Overview',
    description: 'MyTradeLedger is a personal trade tracking application for recording buys and sells across any asset class, with automatic P&L calculation and a full REST API.',
  },
  quickstart: {
    title: 'Quick Start',
    description: 'From zero to your first realized P&L in five steps — create an account, add BUY and SELL trades, and view your gains on the dashboard.',
  },
  concepts: {
    title: 'Core Concepts',
    description: 'Understand the MyTradeLedger data model: users, accounts, ledger entries, entry metadata, valueBase, and how P&L is calculated.',
  },
  accounts:              { title: 'Accounts Guide' },
  ledger:                { title: 'Ledger Entries' },
  pnl:                   { title: 'P&L Calculation' },
  'csv-export':          { title: 'CSV Export' },
  metadata:              { title: 'Entry Metadata' },
  'api/authentication':  { title: 'Authentication API' },
  'api/accounts':        { title: 'Accounts API' },
  'api/ledger':          { title: 'Ledger API' },
  'api/assets':          { title: 'Assets API' },
};

export function DocsLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const docPath = location.pathname.replace(/^\/docs\/?/, '') || 'overview';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const close = (e: MouseEvent) => {
      if (!mobileNavRef.current?.contains(e.target as Node)) setMobileNavOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [mobileNavOpen]);

  useEffect(() => {
    const pageMeta = PAGE_META[docPath] ?? { title: 'Documentation' };
    document.title = `${pageMeta.title} — MyTradeLedger Docs`;

    let el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'description');
      document.head.appendChild(el);
    }
    el.setAttribute(
      'content',
      pageMeta.description ?? 'MyTradeLedger documentation — User Guide and API Reference.',
    );
  }, [docPath]);

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">

      {user ? <AppNavbar /> : <PublicNavbar />}

      {/* Docs body */}
      <div className="flex flex-1" style={{ minHeight: 'calc(100vh - 4rem)' }}>

        {/* Sidebar - desktop only */}
        <aside
          className="hidden md:block w-60 shrink-0 border-r border-base-300 bg-base-100 sticky top-16 overflow-y-auto"
          style={{ height: 'calc(100vh - 4rem)' }}
        >
          <nav className="px-3 py-5 space-y-6" aria-label="Documentation navigation">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 px-3 mb-1">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = docPath === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={`/docs/${item.path}`}
                          className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">

          {/* Mobile: collapsible docs nav */}
          <div ref={mobileNavRef} className="md:hidden border-b border-base-300">
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium"
              onClick={() => setMobileNavOpen(v => !v)}
              aria-expanded={mobileNavOpen}
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Navigation
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-base-content/40 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {mobileNavOpen && (
              <nav className="px-4 pb-4 space-y-4">
                {NAV.map((group) => (
                  <div key={group.section}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">
                      {group.section}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = docPath === item.path;
                        return (
                          <li key={item.path}>
                            <Link
                              to={`/docs/${item.path}`}
                              className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
                              }`}
                              onClick={() => setMobileNavOpen(false)}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            )}
          </div>

          <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}
