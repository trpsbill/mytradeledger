export interface NavItem {
  path: string;
  label: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    section: 'Getting Started',
    items: [
      { path: 'overview', label: 'Overview' },
      { path: 'quickstart', label: 'Quick Start' },
      { path: 'concepts', label: 'Core Concepts' },
    ],
  },
  {
    section: 'User Guide',
    items: [
      { path: 'accounts', label: 'Accounts' },
      { path: 'ledger', label: 'Ledger Entries' },
      { path: 'pnl', label: 'P&L Calculation' },
      { path: 'csv-export', label: 'CSV Export' },
      { path: 'metadata', label: 'Entry Metadata' },
    ],
  },
  {
    section: 'API Reference',
    items: [
      { path: 'api/authentication', label: 'Authentication' },
      { path: 'api/accounts', label: 'Accounts' },
      { path: 'api/ledger', label: 'Ledger' },
      { path: 'api/assets', label: 'Assets' },
    ],
  },
];
