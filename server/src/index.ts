import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import accountRoutes from './routes/accountRoutes';
import assetRoutes from './routes/assetRoutes';
import ledgerRoutes from './routes/ledgerRoutes';
import importRoutes from './routes/importRoutes';
import billingRoutes from './routes/billingRoutes';
import supportRoutes from './routes/supportRoutes';
import clientLogsRoutes from './routes/clientLogsRoutes';
import { billingController } from './controllers/billingController';
import { requireAuth } from './middleware/auth';
import { requestLogger } from './middleware/requestLogger';
import { demoService } from './services/demoService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Number of reverse proxies in front of the app, so express-rate-limit can read
// the real client IP from X-Forwarded-For. Hop count is deployment-specific:
//   prod (Traefik -> nginx -> server) = 2; dev (direct to the port) = 0.
// A wrong value either breaks rate limiting (everyone shares one bucket) or lets
// clients spoof X-Forwarded-For to dodge it, so this is explicit, not assumed.
// Numeric (never bare `true`) keeps express-rate-limit's spoof check happy.
const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
app.set('trust proxy', Number.isNaN(trustProxy) ? 0 : trustProxy);

app.use(cors());
app.use(requestLogger);

// Stripe webhook must receive the raw body for signature verification — register
// it BEFORE the express.json() middleware that would consume/parse the body.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.handleWebhook);

// Cap request bodies: these endpoints only ever receive small JSON payloads, so
// a small limit removes a cheap memory-exhaustion vector.
app.use(express.json({ limit: '10kb' }));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// All other API routes require authentication
app.use('/api/accounts', requireAuth, accountRoutes);
app.use('/api/assets', requireAuth, assetRoutes);
app.use('/api/ledger', requireAuth, ledgerRoutes);
app.use('/api/import', requireAuth, importRoutes);
app.use('/api/billing', requireAuth, billingRoutes);
app.use('/api/support', requireAuth, supportRoutes);
app.use('/api/client-logs', requireAuth, clientLogsRoutes);

// Account-scoped ledger shortcut
app.get('/api/accounts/:accountId/ledger', requireAuth, async (req, res) => {
  const { accountId } = req.params;
  const queryString = new URLSearchParams({
    ...req.query as Record<string, string>,
    accountId,
  }).toString();
  res.redirect(`/api/ledger?${queryString}`);
});

// Captures errors passed via next(err) and makes them available to requestLogger
// via res.locals.error. Must be registered after all routes.
const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) { next(err); return; }
  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;
  res.locals.error = { message, stack };
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

// Periodic sweep for expired "Try Live Demo" users (see demoService). No new
// scheduler dependency — a plain interval is enough at this volume, and the
// try/catch inside runDemoCleanup ensures one failing run can't kill the
// interval or crash the process.
const DEMO_CLEANUP_INTERVAL_MS = parseInt(process.env.DEMO_CLEANUP_INTERVAL_MS ?? '') || 15 * 60 * 1000;

async function runDemoCleanup() {
  try {
    const { deletedDemoUsers } = await demoService.cleanupExpiredDemoUsers();
    if (deletedDemoUsers > 0) {
      // eslint-disable-next-line no-console
      console.log(`[demo-cleanup] purged ${deletedDemoUsers} expired demo user(s)`);
    }
  } catch (err) {
    console.error('[demo-cleanup] run failed:', err instanceof Error ? err.message : err);
  }
}

runDemoCleanup(); // catch anything that expired while the process was down
setInterval(runDemoCleanup, DEMO_CLEANUP_INTERVAL_MS);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});
