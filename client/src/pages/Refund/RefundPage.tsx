import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks';

const GITHUB_URL = 'https://github.com/trpsbill/mytradeledger';

const bg = '#0f1117';
const surface = '#161b22';
const border = '#30363d';
const textPrimary = '#e6edf3';
const textSecondary = '#8b949e';
const textMuted = '#6e7681';
const green = '#22c55e';
const greenBright = '#4ade80';

const sections = [
  {
    heading: 'Cancel Anytime',
    body: [
      'You can cancel your MyTradeLedger subscription at any time from your account settings. When you cancel, your plan remains active until the end of your current billing period, and you will not be charged again.',
    ],
  },
  {
    heading: 'No Refunds',
    body: [
      'All payments are non-refundable. We do not provide refunds or credits for partial subscription periods, unused time, or downgrades, except where required by applicable law.',
    ],
  },
  {
    heading: 'Questions?',
    body: [
      'Contact us at billw@mytradeledger.com.',
    ],
  },
  {
    heading: 'Contact',
    body: [
      'Treasoro LLC\nbillw@mytradeledger.com',
    ],
  },
];

export function RefundPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="min-h-screen"
      style={{ background: bg, color: textPrimary, fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-sm"
        style={{ background: `${bg}f0`, borderBottom: `1px solid ${border}` }}
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center h-16 gap-4">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-lg hover:opacity-90 transition-opacity" style={{ color: textPrimary }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
              <rect width="100" height="100" rx="10" fill={green} />
              <text x="50" y="68" fontFamily="monospace" fontSize="50" fontWeight="bold" fill={bg} textAnchor="middle">TL</text>
            </svg>
            MyTradeLedger
          </Link>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-1 text-sm">
            {[
              { label: 'Docs',   to: '/docs',    external: false },
              { label: 'GitHub', to: GITHUB_URL, external: true  },
              { label: 'Log In', to: '/login',   external: false },
            ].map(({ label, to, external }) =>
              external ? (
                <a key={label} href={to} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 rounded-md transition-colors" style={{ color: textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to}
                  className="px-3 py-2 rounded-md transition-colors" style={{ color: textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}>
                  {label}
                </Link>
              )
            )}
          </div>

          <button
            className="w-9 h-9 flex items-center justify-center rounded-md transition-colors"
            style={{ color: textSecondary }}
            onClick={toggleTheme}
            aria-label="Toggle light/dark theme"
            onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}
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

          <Link
            to="/signup"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: green, color: bg }}
            onMouseEnter={e => (e.currentTarget.style.background = greenBright)}
            onMouseLeave={e => (e.currentTarget.style.background = green)}
          >
            Start Tracking
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-3" style={{ color: textPrimary }}>
          Cancellation Policy
        </h1>
        <p className="text-sm mb-12" style={{ color: textMuted }}>Last updated: June 20, 2026</p>

        <div
          className="rounded-xl p-8 mb-10 text-sm leading-relaxed"
          style={{ background: surface, border: `1px solid ${border}`, color: textSecondary }}
        >
          Treasoro LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates MyTradeLedger.
        </div>

        <div className="space-y-10">
          {sections.map(({ heading, body }) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: textPrimary }}>{heading}</h2>
              <div className="space-y-3">
                {body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed whitespace-pre-line" style={{ color: textSecondary }}>
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${border}` }} role="contentinfo">
        <div className="max-w-6xl mx-auto px-6 py-10 text-center">
          <p className="text-sm mb-4" style={{ color: textMuted }}>
            MyTradeLedger is a record-keeping tool, not financial, tax, or investment advice.
          </p>
          <nav className="flex justify-center flex-wrap gap-6 text-sm mb-6" aria-label="Footer navigation">
            {[
              { label: 'Docs',             to: '/docs',    external: false },
              { label: 'GitHub',           to: GITHUB_URL, external: true  },
              { label: 'Terms of Service', to: '/terms',   external: false },
              { label: 'Privacy Policy',   to: '/privacy', external: false },
              { label: 'Cancellation Policy', to: '/refund',  external: false },
              { label: 'Log In',           to: '/login',   external: false },
            ].map(({ label, to, external }) =>
              external ? (
                <a key={label} href={to} target="_blank" rel="noopener noreferrer" style={{ color: textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textMuted)}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to} style={{ color: textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textMuted)}>
                  {label}
                </Link>
              )
            )}
          </nav>
          <p className="text-xs" style={{ color: textMuted }}>
            &copy; 2026 Treasoro LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
