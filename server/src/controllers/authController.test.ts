// Unit test for authController.register's Better Stack signup logging.
// authService is mocked so no DB is touched.

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLogtailForTests } from '../config/logger';

const mockRegister = vi.hoisted(() => vi.fn());
const mockSignToken = vi.hoisted(() => vi.fn().mockReturnValue('signed-jwt'));
const mockCreateDemoUser = vi.hoisted(() => vi.fn());
const mockCleanupExpiredDemoUsers = vi.hoisted(() => vi.fn());
const mockDeleteDemoUser = vi.hoisted(() => vi.fn());
const mockLogInfo = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../services/authService', () => ({
  authService: { register: mockRegister },
  signToken: mockSignToken,
}));

vi.mock('../services/demoService', () => ({
  demoService: {
    createDemoUser: mockCreateDemoUser,
    cleanupExpiredDemoUsers: mockCleanupExpiredDemoUsers,
    deleteDemoUser: mockDeleteDemoUser,
  },
}));

vi.mock('@logtail/node', () => ({
  Logtail: vi.fn().mockImplementation(() => ({ info: mockLogInfo, error: vi.fn().mockResolvedValue(undefined) })),
}));

import { authController } from './authController';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/register', authController.register);
  app.post('/api/auth/demo-login', authController.demoLogin);
  app.post('/api/auth/purge-demo-users', authController.purgeDemoUsers);
  app.delete('/api/auth/demo-session', (req, _res, next) => {
    req.user = { userId: 'user-1', email: 'test@example.com', isPaid: false };
    next();
  }, authController.deleteDemoSession);
  return app;
}

beforeEach(() => {
  mockRegister.mockClear();
  mockSignToken.mockClear();
  mockCreateDemoUser.mockReset();
  mockCleanupExpiredDemoUsers.mockReset();
  mockDeleteDemoUser.mockReset();
  mockLogInfo.mockClear();
  process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
  __resetLogtailForTests();
});

afterEach(() => {
  delete process.env.LOGTAIL_SOURCE_TOKEN;
  __resetLogtailForTests();
});

describe('authController.register — Better Stack logging', () => {
  it('logs a signup event on successful registration', async () => {
    mockRegister.mockResolvedValue({
      user: { id: 'user-123', email: 'new@user.com', isPaid: false, emailVerifiedAt: null },
      token: 'jwt-token',
    });

    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ email: 'new@user.com', password: 'longenoughpassword' });

    expect(res.status).toBe(201);
    expect(mockLogInfo).toHaveBeenCalledOnce();
    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('user signup');
    expect(fields).toMatchObject({ source: 'server', event: 'signup', userId: 'user-123', email: 'new@user.com' });
  });

  it('does not log when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('EMAIL_IN_USE'));

    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ email: 'dup@user.com', password: 'longenoughpassword' });

    expect(res.status).toBe(409);
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it('does not log when LOGTAIL_SOURCE_TOKEN is not set', async () => {
    delete process.env.LOGTAIL_SOURCE_TOKEN;
    __resetLogtailForTests();
    mockRegister.mockResolvedValue({
      user: { id: 'user-123', email: 'new@user.com', isPaid: false, emailVerifiedAt: null },
      token: 'jwt-token',
    });

    await request(buildApp())
      .post('/api/auth/register')
      .send({ email: 'new@user.com', password: 'longenoughpassword' });

    expect(mockLogInfo).not.toHaveBeenCalled();
  });
});

describe('authController.demoLogin', () => {
  it('creates a demo user, signs a token, and returns isDemo: true', async () => {
    mockCreateDemoUser.mockResolvedValue({
      id: 'demo-1',
      email: 'demo-abc@demo.mytradeledger.local',
      isPaid: false,
      isDemo: true,
    });

    const res = await request(buildApp()).post('/api/auth/demo-login').send({});

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBe('signed-jwt');
    expect(res.body.data.user).toMatchObject({
      id: 'demo-1',
      email: 'demo-abc@demo.mytradeledger.local',
      isPaid: false,
      emailVerified: true,
      isDemo: true,
    });
    expect(mockSignToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'demo-1', isDemo: true }));
  });

  it('returns 500 when demo user creation fails', async () => {
    mockCreateDemoUser.mockRejectedValue(new Error('db down'));

    const res = await request(buildApp()).post('/api/auth/demo-login').send({});

    expect(res.status).toBe(500);
  });
});

describe('authController.purgeDemoUsers', () => {
  it('returns the cleanup count', async () => {
    mockCleanupExpiredDemoUsers.mockResolvedValue({ deletedDemoUsers: 2 });

    const res = await request(buildApp()).post('/api/auth/purge-demo-users').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { deletedDemoUsers: 2 } });
  });

  it('returns 500 when cleanup fails', async () => {
    mockCleanupExpiredDemoUsers.mockRejectedValue(new Error('db down'));

    const res = await request(buildApp()).post('/api/auth/purge-demo-users').send({});

    expect(res.status).toBe(500);
  });
});

describe('authController.deleteDemoSession', () => {
  it('deletes the caller\'s demo user and returns 204', async () => {
    mockDeleteDemoUser.mockResolvedValue({ deleted: true });

    const res = await request(buildApp()).delete('/api/auth/demo-session');

    expect(res.status).toBe(204);
    expect(mockDeleteDemoUser).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when deletion fails', async () => {
    mockDeleteDemoUser.mockRejectedValue(new Error('db down'));

    const res = await request(buildApp()).delete('/api/auth/demo-session');

    expect(res.status).toBe(500);
  });
});
