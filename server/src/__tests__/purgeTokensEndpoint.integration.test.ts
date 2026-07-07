import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const sentVerificationTokens: Array<{ email: string; token: string }> = [];
const sentResetTokens: Array<{ email: string; token: string }> = [];

vi.mock('../services/email', () => ({
  sendVerificationEmail: vi.fn(async (user: { email: string }, rawToken: string) => {
    sentVerificationTokens.push({ email: user.email, token: rawToken });
  }),
  sendPasswordResetEmail: vi.fn(async (user: { email: string }, rawToken: string) => {
    sentResetTokens.push({ email: user.email, token: rawToken });
  }),
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import prisma from '../db';
import authRoutes from '../routes/authRoutes';
import { authService } from '../services/authService';
import { authEmailGuard } from '../services/emailSendGuard';

let app: express.Express;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/auth', authRoutes);
});

beforeEach(async () => {
  sentVerificationTokens.length = 0;
  sentResetTokens.length = 0;
  authEmailGuard.reset();

  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.personalAccessToken.deleteMany();
  await prisma.ledgerMetadata.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/purge-tokens — admin auth guard', () => {
  const ADMIN_KEY = 'super-secret-admin-key-42';

  beforeEach(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
  });

  it('returns 401 when X-Admin-Key header is missing', async () => {
    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/admin key/i);
  });

  it('returns 401 when X-Admin-Key header has a wrong value', async () => {
    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .set('X-Admin-Key', 'wrong-key')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/admin key/i);
  });

  it('returns 501 when ADMIN_API_KEY is not configured', async () => {
    delete process.env.ADMIN_API_KEY;

    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .set('X-Admin-Key', 'anything')
      .send({});

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/not configured/i);
  });
});

describe('POST /api/auth/purge-tokens — happy path', () => {
  const ADMIN_KEY = 'super-secret-admin-key-42';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
  });

  it('returns 200 with zero counts when there are no stale tokens', async () => {
    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { deletedVerificationTokens: 0, deletedResetTokens: 0 },
    });
  });

  it('returns 200 and deletes used verification + used/expired reset tokens in a single call', async () => {
    await authService.register('purge-e2e@example.com', 'password123', false);
    const verifyToken = sentVerificationTokens[0].token;
    await authService.verifyEmail(verifyToken);

    await authService.requestPasswordReset('purge-e2e@example.com');
    const resetToken = sentResetTokens[0].token;
    await authService.resetPassword(resetToken, 'new-password');

    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.deletedVerificationTokens).toBe(1);
    expect(res.body.data.deletedResetTokens).toBe(1);

    const remainingVerify = await prisma.emailVerificationToken.findMany();
    const remainingReset = await prisma.passwordResetToken.findMany();
    expect(remainingVerify).toHaveLength(0);
    expect(remainingReset).toHaveLength(0);
  });
});

describe('POST /api/auth/purge-tokens — rate limiting', () => {
  const ADMIN_KEY = 'rate-limit-admin-key';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
  });

  it('rate-limits excessive purge requests with a 429 error shape', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/purge-tokens')
        .set('X-Admin-Key', ADMIN_KEY)
        .send({});
    }

    const res = await request(app)
      .post('/api/auth/purge-tokens')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'Too many purge requests, please try again later',
    });
  });
});
