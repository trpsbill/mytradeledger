import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks';
import dashboardScreenshot from '../../assets/screenshots/dashboard.jpg';
import ledgerNewEntryScreenshot from '../../assets/screenshots/ledger-new-entry.jpg';
import aiAgentDemoScreenshot from '../../assets/screenshots/ai-agent-demo.jpg';
import importCsvScreenshot from '../../assets/screenshots/import-csv.jpg';

const GITHUB_URL = 'https://github.com/trpsbill/mytradeledger';
const AI_SKILL_URL = 'https://github.com/trpsbill/skills/tree/main/skills/mytradeledger';
const FOUNDER_URL = 'https://www.tiktok.com/@mytradeledger';
const X_URL = 'https://x.com/MyTradeLedgerAp';
const TIKTOK_URL = FOUNDER_URL;

const homeNavLinks = [
  { label: 'Docs',   to: '/docs',    external: false },
  { label: 'GitHub', to: GITHUB_URL, external: true  },
  { label: 'Log In', to: '/login',   external: false },
] as const;

// ── Design tokens ─────────────────────────────────────────────────────────
const bg = '#0f1117';
const surface = '#161b22';
const surfaceAlt = '#0a0d12';
const border = '#30363d';
const textPrimary = '#e6edf3';
const textSecondary = '#8b949e';
const textMuted = '#6e7681';
const green = '#22c55e';
const greenBright = '#4ade80';

// ── Product screenshot ────────────────────────────────────────────────────

function Screenshot({ src, alt, caption, onClick }: { src: string; alt: string; caption?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block w-full text-left rounded-xl overflow-hidden shadow-2xl cursor-zoom-in transition-transform hover:scale-[1.01]"
      style={{ border: `1px solid ${border}` }}
      aria-label={`${alt} — click to view full size`}
    >
      <img src={src} alt="" className="w-full block" />
      {caption && (
        <span
          className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md text-xs font-mono"
          style={{ background: 'rgba(15,17,23,0.85)', color: textSecondary, border: `1px solid ${border}` }}
        >
          {caption}
        </span>
      )}
    </button>
  );
}

// ── Screenshot lightbox ───────────────────────────────────────────────────

function ScreenshotLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 flex items-center justify-center rounded-full transition-colors"
        style={{ background: surface, border: `1px solid ${border}`, color: textPrimary }}
        aria-label="Close screenshot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// ── API / curl snippet ────────────────────────────────────────────────────

function CurlSnippet() {
  return (
    <div
      role="img"
      aria-label="Terminal code example: curl request to /api/ledger using a Bearer token, with JSON response showing a BTC SELL entry with $420 realized P&L"
      className="w-full rounded-xl overflow-hidden shadow-2xl"
      style={{ border: `1px solid ${border}` }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: surface, borderBottom: `1px solid ${border}` }}>
        <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        <span className="ml-3 text-xs font-mono" style={{ color: textMuted }}>Terminal</span>
      </div>

      <div className="p-5 font-mono text-sm leading-loose overflow-x-auto" style={{ background: bg }}>
        <div style={{ color: textMuted }}># Fetch your trade history — returns paginated JSON</div>
        <div>
          <span style={{ color: '#79c0ff' }}>curl</span>
          <span style={{ color: textPrimary }}> -s https://your-instance.example.com/api/ledger \</span>
        </div>
        <div className="pl-4">
          <span style={{ color: '#79c0ff' }}>-H</span>
          <span style={{ color: textPrimary }}> &ldquo;</span>
          <span style={{ color: '#a5d6ff' }}>Authorization: Bearer </span>
          <span style={{ color: greenBright }}>mtl_a1b2c3d4e5f6&hellip;</span>
          <span style={{ color: textPrimary }}>&rdquo; \</span>
        </div>
        <div>
          <span style={{ color: textSecondary }}>  | </span>
          <span style={{ color: '#79c0ff' }}>jq</span>
          <span style={{ color: textPrimary }}> &lsquo;</span>
          <span style={{ color: '#a5d6ff' }}>.data[] | {'{'} date, symbol, type, quantity, pnl {'}'}</span>
          <span style={{ color: textPrimary }}>&rsquo;</span>
        </div>

        <div className="mt-5" style={{ color: textMuted }}># Response:</div>
        <div style={{ color: textSecondary }}>{'{'}</div>
        {[
          ['"date"',     '"2024-01-15"',  textPrimary],
          ['"symbol"',   '"BTC"',         textPrimary],
          ['"type"',     '"SELL"',        '#f87171'],
          ['"quantity"', '-0.1',          '#f8c33a'],
          ['"pnl"',      '420.00',        green],
        ].map(([key, val, valColor], i, arr) => (
          <div key={i} className="pl-4">
            <span style={{ color: '#a5d6ff' }}>{key}</span>
            <span style={{ color: textSecondary }}>: </span>
            <span style={{ color: valColor as string }}>{val}</span>
            {i < arr.length - 1 && <span style={{ color: textSecondary }}>,</span>}
          </div>
        ))}
        <div style={{ color: textSecondary }}>{'}'}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function HomePage() {
  const { user, signupsEnabled } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const close = (e: MouseEvent) => {
      if (!mobileNavRef.current?.contains(e.target as Node)) setMobileNavOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [mobileNavOpen]);

  // Staggered page-load reveal — rAF defers the state update past the first
  // paint so the CSS transition actually runs (avoids set-state-in-effect).
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // SEO meta tags
  useEffect(() => {
    document.title = 'MyTradeLedger — Private Crypto Trade Journal & P&L Tracker';

    const setMeta = (nameOrProp: string, content: string, isProp = false) => {
      const attr = isProp ? 'property' : 'name';
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${nameOrProp}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, nameOrProp);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = 'A private, open-source, self-hosted crypto trade ledger with a real API and CSV export. Track buys, sells, and realized P&L.';
    const title = 'MyTradeLedger — Private Crypto Trade Journal & P&L Tracker';

    setMeta('description', desc);
    setMeta('og:title', title, true);
    setMeta('og:description', desc, true);
    setMeta('og:type', 'website', true);
    setMeta('og:url', window.location.origin, true);
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
  }, []);

  if (user) return <Navigate to="/app" replace />;

  const fade = (delay = 0): React.CSSProperties => ({
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(18px)',
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: bg, color: textPrimary, fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}
    >

      {/* ── Nav ── */}
      <nav
        ref={mobileNavRef}
        className="sticky top-0 z-50 backdrop-blur-sm"
        style={{ background: `${bg}f0`, borderBottom: `1px solid ${border}` }}
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-lg hover:opacity-90 transition-opacity" style={{ color: textPrimary }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
              <rect width="100" height="100" rx="10" fill={green}/>
              <text x="50" y="68" fontFamily="monospace" fontSize="50" fontWeight="bold" fill={bg} textAnchor="middle">TL</text>
            </svg>
            MyTradeLedger
          </Link>

          <div className="flex-1" />

          {/* Nav links - desktop */}
          <div className="hidden md:flex items-center gap-1 text-sm">
            {homeNavLinks.map(({ label, to, external }) =>
              external ? (
                <a key={label} href={to} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-md transition-colors" style={{ color: textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to} className="px-3 py-2 rounded-md transition-colors" style={{ color: textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}>
                  {label}
                </Link>
              )
            )}
          </div>

          {/* Theme toggle */}
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

          {/* Social links - desktop */}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex w-9 h-9 items-center justify-center rounded-md transition-colors"
            style={{ color: textSecondary }}
            aria-label="MyTradeLedger on X"
            onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex w-9 h-9 items-center justify-center rounded-md transition-colors"
            style={{ color: textSecondary }}
            aria-label="MyTradeLedger on TikTok"
            onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.43 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          </a>

          {/* Primary CTA - desktop */}
          {signupsEnabled ? (
            <Link
              to="/signup"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: green, color: bg }}
              onMouseEnter={e => (e.currentTarget.style.background = greenBright)}
              onMouseLeave={e => (e.currentTarget.style.background = green)}
            >
              Get Started
            </Link>
          ) : (
            <span
              className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: `1px solid ${border}`, color: textMuted }}
            >
              Coming soon
            </span>
          )}

          {/* Hamburger - mobile only */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-md transition-colors"
            style={{ color: textSecondary }}
            onClick={() => setMobileNavOpen(v => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}
          >
            {mobileNavOpen ? (
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

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div
            className="md:hidden px-6 py-4 flex flex-col gap-3"
            style={{ borderTop: `1px solid ${border}` }}
          >
            {homeNavLinks.map(({ label, to, external }) =>
              external ? (
                <a key={label} href={to} target="_blank" rel="noopener noreferrer"
                  className="text-sm py-2 transition-colors" style={{ color: textSecondary }}>
                  {label}
                </a>
              ) : (
                <Link key={label} to={to} onClick={() => setMobileNavOpen(false)}
                  className="text-sm py-2 transition-colors" style={{ color: textSecondary }}>
                  {label}
                </Link>
              )
            )}
            {signupsEnabled && (
              <Link
                to="/signup"
                onClick={() => setMobileNavOpen(false)}
                className="mt-1 text-center py-2 px-4 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: green, color: bg }}
              >
                Get Started
              </Link>
            )}
          </div>
        )}
      </nav>

      <main>

        {/* ── Hero ── */}
        <section className="max-w-[96rem] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 lg:pt-20 pb-14 sm:pb-20 lg:pb-24" aria-label="Hero">
          <div className="grid lg:grid-cols-[1fr_1.7fr] gap-10 lg:gap-14 items-center">

            {/* Copy */}
            <div className="min-w-0">
              <div style={fade(0)}>
                <div className="flex w-fit max-w-full items-start gap-2 text-xs font-mono px-3 py-1.5 rounded-2xl mb-6"
                  style={{ border: `1px solid rgba(34,197,94,0.3)`, color: green, background: 'rgba(34,197,94,0.08)' }}>
                  <span>✓ No spreadsheets · ✓ Open source · ✓ Self-hosted</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-tight tracking-tight mb-5" style={{ ...fade(80), color: textPrimary }}>
                The crypto journal that tracks your real P&L.
              </h1>

              <p className="text-lg leading-relaxed mb-8" style={{ ...fade(180), color: textSecondary }}>
                Fees, cost basis, open positions — calculated automatically. No spreadsheets.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-4" style={fade(280)}>
                {signupsEnabled ? (
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-base transition-colors"
                    style={{ background: green, color: bg }}
                    onMouseEnter={e => (e.currentTarget.style.background = greenBright)}
                    onMouseLeave={e => (e.currentTarget.style.background = green)}
                  >
                    Get Started →
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-base"
                    style={{ border: `1px solid ${border}`, color: textMuted }}
                  >
                    Signups coming soon
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-base" style={{ color: textSecondary }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Free and open source · <strong className="font-bold" style={{ color: textPrimary }}>run it yourself</strong></span>
                </span>
              </div>

              <p className="text-sm mt-3" style={{ ...fade(320), color: textMuted }}>
                Built by a solo developer who was frustrated with every existing crypto journal —{' '}
                <a
                  href={FOUNDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition-colors"
                  style={{ color: textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = textSecondary)}
                >
                  follow along
                </a>.
              </p>
            </div>

            {/* Dashboard screenshot */}
            <div className="min-w-0" style={fade(160)}>
              <Screenshot
                src={dashboardScreenshot}
                caption="Dashboard"
                alt="Dashboard screenshot: action bar with Export CSV, Import CSV, and New Entry buttons, per-account P&L summary cards, and a recent trades table"
                onClick={() => setLightbox({
                  src: dashboardScreenshot,
                  alt: 'Dashboard screenshot: action bar with Export CSV, Import CSV, and New Entry buttons, per-account P&L summary cards, and a recent trades table',
                })}
              />
            </div>
          </div>
        </section>

        {/* ── AI Skill Integration ── */}
        <section style={{ borderTop: `1px solid ${border}`, background: surfaceAlt }} aria-label="AI skill integration">
          <div className="max-w-[96rem] mx-auto px-4 sm:px-6 py-12 md:py-20">
            <div className="grid lg:grid-cols-[1.7fr_1fr] gap-10 lg:gap-16 items-center">

              <div className="min-w-0 order-2 lg:order-1">
                <Screenshot
                  src={aiAgentDemoScreenshot}
                  caption="AI Skill Integration"
                  alt="Split view of the MyTradeLedger dashboard next to a Claude conversation analyzing the account's trade history and P&L"
                  onClick={() => setLightbox({
                    src: aiAgentDemoScreenshot,
                    alt: "Split view of the MyTradeLedger dashboard next to a Claude conversation analyzing the account's trade history and P&L",
                  })}
                />
              </div>

              <div className="min-w-0 order-1 lg:order-2">
                <div
                  className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-2xl mb-5"
                  style={{ border: `1px solid rgba(34,197,94,0.3)`, color: green, background: 'rgba(34,197,94,0.08)' }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  AI Skill Integration
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: textPrimary }}>
                  Manage your ledger from your AI assistant
                </h2>
                <p className="leading-relaxed mb-4 flex items-start gap-2" style={{ color: textSecondary }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke={green} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Works with your AI assistant — ask about your trades in plain language.</span>
                </p>
                <p className="leading-relaxed mb-5" style={{ color: textSecondary }}>
                  No other crypto trade journal lets you do this: install the MyTradeLedger skill
                  and your AI agent (Claude, and more) can read and manage your ledger through
                  natural language — no dashboard required.
                </p>
                <ul className="space-y-3 mb-8" role="list">
                  {[
                    'Log trades and check P&L without opening the app',
                    'Query open positions, account balances, and trade history',
                    'Import and export data through conversation',
                    'Works with any AI agent that supports skills',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: green }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm leading-relaxed" style={{ color: textSecondary }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={AI_SKILL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: green, color: bg }}
                  onMouseEnter={e => (e.currentTarget.style.background = greenBright)}
                  onMouseLeave={e => (e.currentTarget.style.background = green)}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Get the skill on GitHub →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Value props ── */}
        <section style={{ borderTop: `1px solid ${border}` }} aria-label="Key features">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: '🔑',
                  title: 'A real API, with your own access tokens',
                  body: "Generate a personal API token and script against your ledger however you like. Your data isn't trapped behind a UI.",
                },
                {
                  icon: '📤',
                  title: 'Import and export, your way',
                  body: 'Bulk-import trades from a CSV file, or export your full history anytime — date, type, symbol, quantity, price, fees, realized P&L. No premium-export upsell, no hostage-taking.',
                  image: importCsvScreenshot,
                },
                {
                  icon: '🔓',
                  title: 'Open source, no lock-in',
                  body: 'The application we run for you is exactly the code on GitHub — nothing hidden, nothing different. Your data is yours, always.',
                },
              ].map(card => (
                <div
                  key={card.title}
                  className="p-6 rounded-xl transition-colors"
                  style={{ background: surface, border: `1px solid ${border}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
                >
                  <div className="text-3xl mb-4" aria-hidden="true">{card.icon}</div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: textPrimary }}>{card.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{card.body}</p>
                  {card.image && (
                    <button
                      type="button"
                      onClick={() => setLightbox({
                        src: card.image!,
                        alt: 'Import CSV modal: choose your exchange to start a guided import',
                      })}
                      className="mt-4 w-full rounded-lg overflow-hidden cursor-zoom-in transition-transform hover:scale-[1.01]"
                      style={{ border: `1px solid ${border}` }}
                      aria-label="Import CSV modal: choose your exchange to start a guided import — click to view full size"
                    >
                      <img src={card.image} alt="" className="w-full block" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What it does ── */}
        <section style={{ borderTop: `1px solid ${border}` }} aria-label="Feature list">
          <div className="max-w-[96rem] mx-auto px-4 sm:px-6 py-12 md:py-20">
            <div className="grid lg:grid-cols-[1fr_1.7fr] gap-10 lg:gap-16 items-center">
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: textPrimary }}>
                  Trade tracking that does the math for you
                </h2>
                <p className="leading-relaxed mb-8" style={{ color: textSecondary }}>
                  Every entry updates your position and <em>realized P&L</em> automatically —
                  no spreadsheets, no manual cost-basis math. Log your trades in this
                  open-source crypto tracker and the numbers follow.
                </p>
                <ul className="space-y-4" role="list">
                  {[
                    'Log buys, sells, fees, deposits, and withdrawals across as many accounts as you want',
                    'Automatic realized P&L using the average-cost method',
                    'Live position and net cash-flow per symbol',
                    'Full ledger with filtering, pagination, and CSV import',
                    'Clean, fast interface — no bloat',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ color: green }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm leading-relaxed" style={{ color: textSecondary }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <Screenshot
                  src={ledgerNewEntryScreenshot}
                  caption="Ledger — New Entry"
                  alt="Ledger screenshot showing the trade history table with filters, and the New Ledger Entry form open for adding a trade"
                  onClick={() => setLightbox({
                    src: ledgerNewEntryScreenshot,
                    alt: 'Ledger screenshot showing the trade history table with filters, and the New Ledger Entry form open for adding a trade',
                  })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── API ── */}
        <section style={{ borderTop: `1px solid ${border}`, background: surfaceAlt }} aria-label="API access">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="min-w-0">
                <CurlSnippet />
              </div>

              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: textPrimary }}>
                  Built for people who want their data
                </h2>
                <p className="leading-relaxed mb-5" style={{ color: textSecondary }}>
                  Generate a personal access token in your account settings, then hit the REST API
                  from any script, automation, or tool. Pull your full <em>crypto trade ledger</em> as
                  paginated JSON, filter by account or symbol, and pipe it wherever you like — your
                  own dashboards, spreadsheets, or analysis scripts.
                </p>
                <p className="leading-relaxed" style={{ color: textSecondary }}>
                  No other <em>private crypto tracker</em> gives you this. You always have a
                  machine-readable door out of your own data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Open source ── */}
        <section style={{ borderTop: `1px solid ${border}` }} aria-label="Open source">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center">
            <div className="text-4xl mb-6" aria-hidden="true">🔓</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: textPrimary }}>
              Open source, all the way down
            </h2>
            <p className="leading-relaxed mb-8 text-lg" style={{ color: textSecondary }}>
              The application we run for you is exactly the code on GitHub — inspect it, audit it,
              fork it, or run your own copy. Your data is yours either way.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: `1px solid ${border}`, color: textPrimary }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; e.currentTarget.style.color = green; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textPrimary; }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: `1px solid ${border}`, color: textPrimary }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; e.currentTarget.style.color = green; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textPrimary; }}
              >
                Read the docs →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Get started ── */}
        <section className="scroll-mt-16" style={{ borderTop: `1px solid ${border}`, background: surfaceAlt }} aria-label="Get started">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: textPrimary }}>Free, forever</h2>
            <p className="leading-relaxed mb-10 text-lg" style={{ color: textSecondary }}>
              No pricing tiers, no trade limits, no credit card. Sign up here or run your own instance.
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              {signupsEnabled ? (
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-base transition-colors"
                  style={{ background: green, color: bg }}
                  onMouseEnter={e => (e.currentTarget.style.background = greenBright)}
                  onMouseLeave={e => (e.currentTarget.style.background = green)}
                >
                  Get Started →
                </Link>
              ) : (
                <span
                  className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-base"
                  style={{ border: `1px solid ${border}`, color: textMuted }}
                >
                  Signups coming soon
                </span>
              )}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: `1px solid ${border}`, color: textPrimary }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; e.currentTarget.style.color = green; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textPrimary; }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Self-host for free →
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${border}` }} role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-center">
          <p className="text-sm mb-4" style={{ color: textMuted }}>
            MyTradeLedger is a record-keeping tool, not financial, tax, or investment advice.
          </p>
          <nav className="flex justify-center flex-wrap gap-6 text-sm mb-6" aria-label="Footer navigation">
            {[
              { label: 'Docs',    to: '/docs',       external: false },
              { label: 'GitHub',  to: GITHUB_URL,    external: true  },
              { label: 'Log In',  to: '/login',      external: false },
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

      {lightbox && (
        <ScreenshotLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}

    </div>
  );
}
