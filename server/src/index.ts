import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import accountRoutes from './routes/accountRoutes';
import assetRoutes from './routes/assetRoutes';
import ledgerRoutes from './routes/ledgerRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/accounts', accountRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/ledger', ledgerRoutes);

// Account-scoped ledger entries shortcut
app.get('/api/accounts/:accountId/ledger', async (req, res) => {
  // Redirect to ledger route with accountId filter
  const { accountId } = req.params;
  const queryString = new URLSearchParams({
    ...req.query as Record<string, string>,
    accountId,
  }).toString();
  res.redirect(`/api/ledger?${queryString}`);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
