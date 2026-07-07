// Integration test setup — runs before any test file in this worker.
// Provisions a throwaway PostgreSQL, points DATABASE_URL at it so the Prisma
// singleton in db/index.ts initialises against it, then pushes the current
// schema (including net_pnl).
//
// Two provisioning modes:
//   • Local dev (default): an ephemeral container via Testcontainers. Cleanup is
//     handled by the Testcontainers Ryuk reaper on process exit.
//   • CI (CI=true): reuse the disposable Postgres that the workflow supplies via
//     DATABASE_URL. CI runners often don't expose a Docker socket, so starting a
//     Testcontainers instance there is unreliable — the workflow's `services:`
//     postgres is used instead. Gated on CI (never just on DATABASE_URL being
//     present) so a developer's DATABASE_URL pointing at a real dev database is
//     never wiped by the `db push --accept-data-loss` below.

import { execSync } from 'child_process';

let url: string;

if (process.env.CI === 'true' && process.env.DATABASE_URL) {
  url = process.env.DATABASE_URL;
} else {
  // Dynamic import so the Testcontainers dependency is only loaded when needed
  // (it isn't installed/used on the CI path).
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  url = container.getConnectionUri();
  // Must be set before db/index.ts is imported (which happens when the test file loads).
  process.env.DATABASE_URL = url;
}

// Push the current schema.prisma to the target DB.
// prisma db push is preferred over migrate deploy here because net_pnl doesn't
// have a migration file yet — the column was added to schema.prisma directly.
execSync('npx prisma db push --accept-data-loss', {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'pipe',
});
