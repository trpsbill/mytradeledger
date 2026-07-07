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
    heading: '1. About MyTradeLedger',
    body: [
      'MyTradeLedger is a simple tool for recording crypto trade activity, including buys, sells, fees, deposits, withdrawals, and related ledger entries. It is designed to help users maintain a personal record of trading activity and view basic profit or loss information based on the data they enter.',
      'MyTradeLedger is not a brokerage, exchange, financial advisor, tax advisor, accounting firm, or investment service.',
    ],
  },
  {
    heading: '2. No Financial, Tax, or Legal Advice',
    body: [
      'MyTradeLedger does not provide financial, investment, tax, accounting, or legal advice.',
      'Any calculations, summaries, reports, or profit and loss figures shown in the application are for informational and recordkeeping purposes only. You are responsible for reviewing your own records and consulting qualified professionals before making financial, tax, legal, or investment decisions.',
    ],
  },
  {
    heading: '3. User Responsibility',
    body: [
      'You are responsible for the accuracy, completeness, and legality of the information you enter into MyTradeLedger.',
      'Treasoro LLC is not responsible for errors caused by incorrect, incomplete, duplicated, missing, or outdated user-entered data.',
    ],
  },
  {
    heading: '4. Account and Access',
    body: [
      'If MyTradeLedger is offered as a hosted SaaS service, you are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.',
      'You agree not to access or use MyTradeLedger in a way that could damage, disable, overload, or impair the service, or interfere with another user\'s use of the service.',
    ],
  },
  {
    heading: '5. Self-Hosted Use',
    body: [
      'If you use a self-hosted version of MyTradeLedger, you are responsible for installing, configuring, securing, backing up, maintaining, and updating your own instance.',
      'Treasoro LLC is not responsible for data loss, security issues, downtime, misconfiguration, unauthorized access, or other problems resulting from self-hosted deployments.',
    ],
  },
  {
    heading: '6. Data Ownership and Privacy',
    body: [
      'You retain ownership of the trade data and records you enter into MyTradeLedger.',
      'If you use the self-hosted version of MyTradeLedger, your data remains under your control in your own environment. Treasoro LLC does not access, store, collect, process, or use your self-hosted trade data. You are responsible for managing, securing, backing up, and maintaining that data.',
      'If you use the hosted SaaS version of MyTradeLedger, Treasoro LLC may store and process your data only as necessary to provide and maintain the hosted service, support account functionality, improve reliability, comply with legal obligations, and protect the service from misuse.',
    ],
  },
  {
    heading: '7. Backups and Data Loss',
    body: [
      'You are responsible for maintaining your own backups of important records.',
      'While Treasoro LLC may take reasonable steps to protect hosted SaaS service data, no system can guarantee complete protection against data loss, corruption, unauthorized access, or service interruption.',
      'For self-hosted use, all backups and recovery processes are your responsibility.',
    ],
  },
  {
    heading: '8. Acceptable Use',
    body: [
      'You agree not to use MyTradeLedger for unlawful purposes or in any way that violates applicable laws or regulations.',
      'You also agree not to attempt to reverse engineer, disrupt, abuse, scrape, overload, or gain unauthorized access to any hosted MyTradeLedger service or related systems.',
    ],
  },
  {
    heading: '9. Availability and Changes',
    body: [
      'Treasoro LLC may modify, suspend, or discontinue any part of MyTradeLedger at any time.',
      'Features may change over time. Treasoro LLC is not obligated to continue offering any specific feature, hosting option, pricing plan, or version of the application.',
    ],
  },
  {
    heading: '10. Payment Terms',
    body: [
      'If MyTradeLedger is offered as a paid hosted SaaS service, fees and billing periods will be described at the time of purchase or subscription. You may cancel your subscription at any time from your account settings; cancellation takes effect at the end of the current billing period. All payments are non-refundable except where required by applicable law.',
      'You are responsible for any applicable taxes, fees, or charges associated with your use of paid services.',
    ],
  },
  {
    heading: '11. Disclaimer of Warranties',
    body: [
      'MyTradeLedger is provided “as is” and “as available.”',
      'Treasoro LLC makes no warranties, express or implied, regarding the accuracy, reliability, availability, fitness for a particular purpose, or suitability of MyTradeLedger for financial, tax, accounting, investment, or legal use.',
    ],
  },
  {
    heading: '12. Limitation of Liability',
    body: [
      'To the fullest extent permitted by law, Treasoro LLC shall not be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, loss of data, trading losses, tax penalties, business interruption, or other damages arising from your use of or inability to use MyTradeLedger.',
    ],
  },
  {
    heading: '13. Termination',
    body: [
      'Treasoro LLC may suspend or terminate access to a hosted MyTradeLedger account if you violate these Terms, misuse the service, fail to pay required fees, or create risk for the service or other users.',
      'You may stop using MyTradeLedger at any time.',
    ],
  },
  {
    heading: '14. Changes to These Terms',
    body: [
      'Treasoro LLC may update these Terms from time to time. Updated Terms will be posted with a revised “Last updated” date.',
      'Continued use of MyTradeLedger after changes are posted means you accept the updated Terms.',
    ],
  },
  {
    heading: '15. Contact',
    body: [
      'Questions about these Terms may be directed to:',
      'Treasoro LLC\nbillw@mytradeledger.com',
    ],
  },
];

export function TermsPage() {
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
          Terms and Conditions
        </h1>
        <p className="text-sm mb-12" style={{ color: textMuted }}>Last updated: June 17, 2026</p>

        <div
          className="rounded-xl p-8 mb-10 text-sm leading-relaxed"
          style={{ background: surface, border: `1px solid ${border}`, color: textSecondary }}
        >
          These Terms and Conditions govern your use of MyTradeLedger, a trade logging application
          operated by Treasoro LLC. By using MyTradeLedger, you agree to these Terms. If you do not
          agree, you should not use the application.
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
              { label: 'Docs',            to: '/docs',   external: false },
              { label: 'GitHub',          to: GITHUB_URL, external: true },
              { label: 'Terms of Service', to: '/terms',   external: false },
              { label: 'Privacy Policy',  to: '/privacy', external: false },
              { label: 'Cancellation Policy', to: '/refund',  external: false },
              { label: 'Log In',          to: '/login',  external: false },
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
