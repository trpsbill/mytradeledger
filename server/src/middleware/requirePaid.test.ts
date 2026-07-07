// Unit tests for the requirePaid middleware.
// Express app on an ephemeral port; Prisma is mocked so no database is needed.

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  default: {
    user: { findUnique: mockFindUnique },
  },
}));

import { requirePaid } from './requirePaid';

// FREE_LIMIT is exported from billingService and imported by requirePaid
const FREE_LIMIT = 25;

function makeApp(userIsPaid: boolean) {
  const app = express();
  app.use((_req, _res, next) => {
    (_req as express.Request & { user: { userId: string; email: string; isPaid: boolean } }).user = {
      userId: 'user-1',
      email: 'test@example.com',
      isPaid: userIsPaid,
    };
    next();
  });
  app.get('/guarded', requirePaid, (_req, res) => res.json({ ok: true }));
  return app;
}

function fakeDbUser(isPaid: boolean, hasHitFreeLimit: boolean, entryCount: number) {
  return {
    isPaid,
    hasHitFreeLimit,
    accounts: [{ _count: { ledgerEntries: entryCount } }],
  };
}

beforeEach(() => {
  mockFindUnique.mockReset();
});

describe('requirePaid — paid fast path', () => {
  it('allows a user whose JWT already has isPaid=true without a DB lookup', async () => {
    const res = await request(makeApp(true)).get('/guarded');
    expect(res.status).toBe(200);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe('requirePaid — free JWT, DB confirms paid', () => {
  it('allows access when webhook updated isPaid in DB after the JWT was issued', async () => {
    mockFindUnique.mockResolvedValueOnce(fakeDbUser(true, false, 5));
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(200);
  });
});

describe('requirePaid — free user under limit', () => {
  it('allows access when total entry count is below FREE_LIMIT', async () => {
    mockFindUnique.mockResolvedValueOnce(fakeDbUser(false, false, 10));
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(200);
  });
});

describe('requirePaid — free user at or over limit', () => {
  it('returns 402 with FREE_LIMIT_REACHED when count equals FREE_LIMIT', async () => {
    mockFindUnique.mockResolvedValueOnce(fakeDbUser(false, false, FREE_LIMIT));
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: 'FREE_LIMIT_REACHED', limit: FREE_LIMIT });
  });

  it('returns 402 when count exceeds FREE_LIMIT', async () => {
    mockFindUnique.mockResolvedValueOnce(fakeDbUser(false, false, FREE_LIMIT + 3));
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(402);
  });
});

describe('requirePaid — hasHitFreeLimit anti-bypass', () => {
  it('returns 402 even when the user has deleted entries back below the limit', async () => {
    mockFindUnique.mockResolvedValueOnce(fakeDbUser(false, true, 5));
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('FREE_LIMIT_REACHED');
  });
});

describe('requirePaid — user not found', () => {
  it('returns 401 when the user record is missing from the database', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = await request(makeApp(false)).get('/guarded');
    expect(res.status).toBe(401);
  });
});
