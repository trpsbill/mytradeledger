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
    heading: '1. Information We Collect',
    body: [
      'Account information: When you register, we collect your email address and a hashed password. We never store your password in plain text.',
      'Trade data: All ledger entries, accounts, and portfolio data you enter into MyTradeLedger are stored on our servers and associated with your account.',
      'Marketing preferences: During registration you may opt in to receive product updates and marketing emails from us. This is optional and you may withdraw consent at any time.',
      'Usage and log data: We collect application logs for the purposes of troubleshooting, support, and maintaining service reliability. This may include IP addresses, browser type, pages visited, and timestamps of actions taken within the app.',
      'Analytics: We use Google Analytics to collect anonymized data about how visitors interact with our marketing site. This data is aggregated and does not personally identify you. Google\'s privacy policy governs data collected through this service.',
    ],
  },
  {
    heading: '2. How We Use Your Information',
    body: [
      'We use the information we collect to:\n\n- Provide, operate, and maintain MyTradeLedger\n- Authenticate your account and keep it secure\n- Send transactional emails (password resets, email verification)\n- Send marketing and product update emails, if you have opted in\n- Diagnose technical issues and respond to support requests\n- Analyze usage patterns to improve the product',
    ],
  },
  {
    heading: '3. Payment Processing',
    body: [
      'Payments are processed by a third-party payment processor. We do not store your payment card details. Please refer to your payment processor\'s privacy policy for information on how your payment data is handled.',
    ],
  },
  {
    heading: '4. Data Sharing',
    body: [
      'We do not sell your personal data. We do not share your data with third parties except:',
      '- With service providers who assist us in operating the product (e.g. email delivery, analytics), under confidentiality obligations\n- As required by law or to respond to legal process\n- To protect the rights, property, or safety of Treasoro LLC or its users',
    ],
  },
  {
    heading: '5. Data Retention',
    body: [
      'We retain your account data for as long as your account is active. If you delete your account, your data will be permanently removed from our systems within 30 days.',
    ],
  },
  {
    heading: '6. Your Rights',
    body: [
      'You may at any time:\n\n- Request a copy of the data we hold about you\n- Request correction of inaccurate data\n- Request deletion of your account and associated data\n- Opt out of marketing emails by clicking the unsubscribe link in any email or contacting us directly',
      'To exercise any of these rights, contact us at billw@mytradeledger.com.',
    ],
  },
  {
    heading: '7. Security',
    body: [
      'We use industry-standard measures to protect your data, including encrypted connections (HTTPS) and hashed password storage. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '8. Children\'s Privacy',
    body: [
      'MyTradeLedger is not directed at children under the age of 13. We do not knowingly collect personal information from children.',
    ],
  },
  {
    heading: '9. Changes to This Policy',
    body: [
      'We may update this policy from time to time. We will notify registered users of material changes via email. The "last updated" date at the top of this page reflects the most recent revision.',
    ],
  },
  {
    heading: '10. Contact',
    body: [
      'Treasoro LLC\nbillw@mytradeledger.com',
    ],
  },
];

export function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm mb-12" style={{ color: textMuted }}>Last updated: June 17, 2026</p>

        <div
          className="rounded-xl p-8 mb-10 text-sm leading-relaxed"
          style={{ background: surface, border: `1px solid ${border}`, color: textSecondary }}
        >
          Treasoro LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates MyTradeLedger and is committed to
          protecting your privacy. This policy explains what information we collect, how we use it, and
          your rights regarding your data.
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
