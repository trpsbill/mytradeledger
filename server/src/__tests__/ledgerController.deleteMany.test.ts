// Unit tests for the deleteMany controller validation.
// Uses a real express app + supertest; ledgerService is mocked so no DB is needed.

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

vi.mock('../services/ledgerService', () => ({
  ledgerService: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('../db', () => ({
  default: {},
}));

import ledgerRoutes from '../routes/ledgerRoutes';

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  // Stub auth: inject a fake user so requireAuth is not needed
  app.use((req, _res, next) => {
    (req as express.Request & { user: { userId: string; isPaid: boolean } }).user = {
      userId: 'test-user-id',
      isPaid: true,
    };
    next();
  });
  app.use('/ledger', ledgerRoutes);
});

describe('DELETE /ledger/batch — input validation', () => {
  it('returns 400 when ids is missing', async () => {
    const res = await request(app).delete('/ledger/batch').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ids must be/i);
  });

  it('returns 400 when ids is an empty array', async () => {
    const res = await request(app).delete('/ledger/batch').send({ ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ids must be/i);
  });

  it('returns 400 when ids contains non-string values', async () => {
    const res = await request(app).delete('/ledger/batch').send({ ids: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ids must be/i);
  });

  it('returns 400 when ids exceeds the 500-item cap', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    const res = await request(app).delete('/ledger/batch').send({ ids });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/batch size exceeds maximum of 500/i);
  });

  it('accepts exactly 500 ids without error', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    const res = await request(app).delete('/ledger/batch').send({ ids });
    expect(res.status).toBe(200);
  });
});
