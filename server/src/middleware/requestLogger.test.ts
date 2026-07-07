import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { ErrorRequestHandler } from 'express';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLogtailForTests } from '../config/logger';

// Mock @logtail/node so no real HTTP calls are made
const mockInfo = vi.fn().mockResolvedValue(undefined);
const mockError = vi.fn().mockResolvedValue(undefined);
vi.mock('@logtail/node', () => ({
  Logtail: vi.fn().mockImplementation(() => ({ info: mockInfo, error: mockError })),
}));

// Import after mock so the mock is in place when the module resolves
import { requestLogger } from './requestLogger';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
  vi.clearAllMocks();
  delete process.env.LOGTAIL_SOURCE_TOKEN;
  delete process.env.LOGTAIL_INGESTING_HOST;
  __resetLogtailForTests();
});

type AppOpts = {
  withUser?: boolean;
  statusCode?: number;
  withParamId?: boolean;
  withErrorHandler?: boolean;
  withSubRouter?: boolean;
  clientLogsStatusCode?: number;
};

function startApp(opts: AppOpts = {}): Promise<string> {
  const app = express();
  // Mirror real app order: logger first, json parser after
  app.use(requestLogger);
  app.use(express.json());

  app.get('/api/test', (req, res) => {
    if (opts.withUser) {
      req.user = { userId: 'user-123', email: 'a@b.com', isPaid: false };
    }
    res.status(opts.statusCode ?? 200).json({ ok: true });
  });

  app.get('/api/boom', (_req, res) => {
    res.status(500).json({ error: 'oops' });
  });

  app.post('/api/test', (_req, res) => {
    res.status(201).json({ ok: true });
  });

  app.patch('/api/test', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  if (opts.clientLogsStatusCode !== undefined) {
    app.post('/api/client-logs', (_req, res) => {
      res.status(opts.clientLogsStatusCode!).end();
    });
  }

  if (opts.withParamId) {
    app.get('/api/items/:id', (_req, res) => {
      res.json({ ok: true });
    });
  }

  if (opts.withSubRouter) {
    const router = express.Router();
    router.get('/:id', (_req, res) => res.json({ ok: true }));
    app.use('/api/things', router);
  }

  if (opts.withErrorHandler) {
    app.get('/api/throw', (_req, _res, next) => {
      next(new Error('Something went wrong'));
    });
    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      const message = err instanceof Error ? err.message : 'Internal server error';
      const stack = err instanceof Error ? err.stack : undefined;
      res.locals.error = { message, stack };
      res.status(500).json({ error: 'Internal server error' });
    };
    app.use(errorHandler);
  }

  return new Promise<string>((resolve) => {
    const s = app.listen(0, () => {
      servers.push(s);
      const { port } = s.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function get(url: string): Promise<number> {
  const res = await fetch(url);
  return res.status;
}

async function post(url: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function patch(url: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('requestLogger — logging disabled', () => {
  it('does not log when LOGTAIL_SOURCE_TOKEN is not set', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });
});

describe('requestLogger — logging enabled', () => {
  beforeEach(() => {
    process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
  });

  it('calls logger.info for a 200 response with the correct fields', async () => {
    const base = await startApp({ withUser: true });
    await get(`${base}/api/test`);
    expect(mockInfo).toHaveBeenCalledOnce();
    const [message, fields] = mockInfo.mock.calls[0];
    expect(message).toBe('GET /api/test 200');
    expect(fields.method).toBe('GET');
    expect(fields.statusCode).toBe(200);
    expect(fields.userId).toBe('user-123');
    expect(fields.error).toBe(false);
    expect(typeof fields.durationMs).toBe('number');
  });

  it('sets userId to null for unauthenticated requests', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.userId).toBeNull();
  });

  it('calls logger.error for a 500 response', async () => {
    const base = await startApp();
    await get(`${base}/api/boom`);
    expect(mockError).toHaveBeenCalledOnce();
    const [message, fields] = mockError.mock.calls[0];
    expect(message).toBe('GET /api/boom 500');
    expect(fields.statusCode).toBe(500);
    expect(fields.error).toEqual({ message: 'Internal server error' });
  });

  it('does not call logger.error for a 200 response', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('includes route, method, statusCode, and durationMs fields', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.route).toBe('/api/test');
    expect(fields.method).toBe('GET');
    expect(fields.statusCode).toBe(200);
    expect(fields.durationMs).toBeGreaterThanOrEqual(0);
  });

  // requestId
  it('includes a UUID requestId on every log', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(typeof fields.requestId).toBe('string');
    expect(UUID_RE.test(fields.requestId as string)).toBe(true);
  });

  it('generates a distinct requestId per request', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    await get(`${base}/api/test`);
    const id1 = mockInfo.mock.calls[0][1].requestId;
    const id2 = mockInfo.mock.calls[1][1].requestId;
    expect(id1).not.toBe(id2);
  });

  // body sanitization
  it('logs sanitized body on POST — redacts password, keeps other fields', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { email: 'a@b.com', password: 'hunter2', amount: 50 });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({ email: 'a@b.com', password: '[REDACTED]', amount: 50 });
  });

  it('redacts token, secret, and authorization fields on POST', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { token: 'abc', secret: 'xyz', authorization: 'Bearer foo', keep: 1 });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({
      token: '[REDACTED]',
      secret: '[REDACTED]',
      authorization: '[REDACTED]',
      keep: 1,
    });
  });

  it('redacts fields whose name contains "password" as a substring (e.g. newPassword, currentPassword)', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { newPassword: 'hunter2', currentPassword: 'old', email: 'a@b.com' });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({
      newPassword: '[REDACTED]',
      currentPassword: '[REDACTED]',
      email: 'a@b.com',
    });
  });

  it('redacts fields whose name contains "token" as a substring (e.g. accessToken, refreshToken)', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { accessToken: 'at', refreshToken: 'rt', userId: 'u1' });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      userId: 'u1',
    });
  });

  it('redacts sensitive fields in nested objects', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { user: { email: 'a@b.com', password: 'secret123' }, keep: 'yes' });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({ user: { email: 'a@b.com', password: '[REDACTED]' }, keep: 'yes' });
  });

  it('redacts sensitive fields inside arrays of objects', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, { items: [{ name: 'a', token: 'tok1' }, { name: 'b', token: 'tok2' }] });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({
      items: [{ name: 'a', token: '[REDACTED]' }, { name: 'b', token: '[REDACTED]' }],
    });
  });

  it('logs sanitized body on PATCH', async () => {
    const base = await startApp();
    await patch(`${base}/api/test`, { name: 'Alice', password: 's3cr3t' });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toEqual({ name: 'Alice', password: '[REDACTED]' });
  });

  it('does not log body on GET', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toBeUndefined();
  });

  it('does not log body when POST body is empty', async () => {
    const base = await startApp();
    await post(`${base}/api/test`, {});
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.body).toBeUndefined();
  });

  // resourceId
  it('logs resourceId when the route has an :id param', async () => {
    const base = await startApp({ withParamId: true });
    await get(`${base}/api/items/abc-123`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.resourceId).toBe('abc-123');
  });

  it('omits resourceId when the route has no :id param', async () => {
    const base = await startApp();
    await get(`${base}/api/test`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.resourceId).toBeUndefined();
  });

  // sub-router prefix
  it('logs the full route including sub-router mount prefix', async () => {
    const base = await startApp({ withSubRouter: true });
    await get(`${base}/api/things/abc-123`);
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.route).toBe('/api/things/:id');
    expect(fields.resourceId).toBe('abc-123');
  });

  // error object from error handler
  it('captures error message and stack when error passes through error handler', async () => {
    const base = await startApp({ withErrorHandler: true });
    await get(`${base}/api/throw`);
    expect(mockError).toHaveBeenCalledOnce();
    const [, fields] = mockError.mock.calls[0];
    expect((fields.error as { message: string }).message).toBe('Something went wrong');
    expect(typeof (fields.error as { stack: string }).stack).toBe('string');
  });

  it('falls back to generic error object for direct 500s without next(err)', async () => {
    const base = await startApp();
    await get(`${base}/api/boom`);
    const [, fields] = mockError.mock.calls[0];
    expect(fields.error).toEqual({ message: 'Internal server error' });
  });

  // /api/client-logs exclusion — its own route already logs the event content
  it('does not log a successful POST to /api/client-logs', async () => {
    const base = await startApp({ clientLogsStatusCode: 204 });
    await post(`${base}/api/client-logs`, { message: 'click - New Entry' });
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('still logs a failed (400) POST to /api/client-logs', async () => {
    const base = await startApp({ clientLogsStatusCode: 400 });
    await post(`${base}/api/client-logs`, {});
    expect(mockInfo).toHaveBeenCalledOnce();
    const [message] = mockInfo.mock.calls[0];
    expect(message).toBe('POST /api/client-logs 400');
  });

  it('still logs a failed (500) POST to /api/client-logs', async () => {
    const base = await startApp({ clientLogsStatusCode: 500 });
    await post(`${base}/api/client-logs`, { message: 'click' });
    expect(mockError).toHaveBeenCalledOnce();
  });
});
