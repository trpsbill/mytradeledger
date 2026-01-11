import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder routes
app.get('/api/accounts', (_req, res) => {
  res.json({ message: 'Accounts endpoint - to be implemented' });
});

app.get('/api/trades', (_req, res) => {
  res.json({ message: 'Trades endpoint - to be implemented' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
