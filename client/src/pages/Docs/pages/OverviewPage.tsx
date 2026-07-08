import { Link } from 'react-router-dom';
import { Callout } from '../components/Callout';

export function OverviewPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Overview</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        MyTradeLedger is a personal trade tracking application for recording buys and sells across
        any asset class — stocks, crypto, ETFs, or anything else you trade. It automatically
        calculates realized P&amp;L using the average cost method.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Key Features
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Multi-Account Support',
              desc: 'Organize trades into separate accounts — one per brokerage, strategy, or tax treatment.',
            },
            {
              title: 'Automatic P&L',
              desc: 'Realized P&L is computed on every SELL entry using the average cost method. No manual math.',
            },
            {
              title: 'Symbol-Agnostic',
              desc: 'Symbols are free-form strings. Track BTC/USD, AAPL, or any custom ticker.',
            },
            {
              title: 'CSV Export',
              desc: 'Download your full ledger or a filtered subset as a CSV for spreadsheets or tax prep.',
            },
            {
              title: 'Entry Metadata',
              desc: 'Attach arbitrary key-value pairs to any entry — order IDs, tax lots, broker notes.',
            },
            {
              title: 'REST API',
              desc: 'A full JSON API lets you import trades from scripts, automate record-keeping, or build integrations.',
            },
          ].map((f) => (
            <div key={f.title} className="border border-base-300 rounded-lg p-4 bg-base-100">
              <h3 className="font-semibold text-base-content mb-1">{f.title}</h3>
              <p className="text-sm text-base-content/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Data Architecture
        </h2>
        <p className="text-base-content/70 mb-4">
          The data model is intentionally simple. Everything flows from a user account down through
          portfolios (accounts) to individual trade records (ledger entries):
        </p>
        <div className="bg-base-200 rounded-lg p-5 font-mono text-sm text-base-content/80 mb-4">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-base-content">User</span>
            <span className="pl-4 text-base-content/50">│</span>
            <span className="pl-4">├── <span className="font-semibold text-base-content">Account</span> (e.g. "Main Portfolio", "Roth IRA")</span>
            <span className="pl-8 text-base-content/50">│</span>
            <span className="pl-8">├── <span className="font-semibold text-base-content">LedgerEntry</span> (BUY / SELL / FEE / ...)</span>
            <span className="pl-12 text-base-content/50">│</span>
            <span className="pl-12">└── <span className="font-semibold text-base-content">LedgerMetadata</span> (key-value pairs)</span>
          </div>
        </div>
        <p className="text-base-content/70 text-sm">
          Each account has an independent position ledger and P&amp;L calculation, so trades in
          one account never affect another.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Tech Stack
        </h2>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Technology</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="text-base-content/70">Frontend</td><td>React 18, Vite, TypeScript, DaisyUI v5 + Tailwind CSS</td></tr>
              <tr><td className="text-base-content/70">Backend</td><td>Node.js, Express, TypeScript</td></tr>
              <tr><td className="text-base-content/70">Database</td><td>PostgreSQL via Prisma ORM</td></tr>
              <tr><td className="text-base-content/70">Auth</td><td>JWT (30-day tokens), bcrypt password hashing</td></tr>
              <tr><td className="text-base-content/70">Deployment</td><td>Docker Compose, Traefik reverse proxy</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <Callout type="tip">
        New here?{' '}
        <Link to="/docs/quickstart" className="underline font-medium">
          Follow the Quick Start guide
        </Link>{' '}
        to record your first trade in under five minutes.
      </Callout>
    </div>
  );
}
