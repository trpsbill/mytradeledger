import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetLogtailForTests } from '../config/logger';

// Mock @logtail/node so no real HTTP calls are made
const mockInfo = vi.fn().mockResolvedValue(undefined);
const mockError = vi.fn().mockResolvedValue(undefined);
vi.mock('@logtail/node', () => ({
  Logtail: vi.fn().mockImplementation(() => ({ info: mockInfo, error: mockError })),
}));

// Import after mock so the mock is in place when the module resolves
import clientLogsRoutes from './clientLogsRoutes';

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

function startApp(): Promise<string> {
  const app = express();
  app.use(express.json());
  // Stand-in for requireAuth — injects a fixed user like the real middleware would.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 'user-123', email: 'a@b.com', isPaid: false };
    next();
  });
  app.use('/api/client-logs', clientLogsRoutes);

  return new Promise<string>((resolve) => {
    const s = app.listen(0, () => {
      servers.push(s);
      const { port } = s.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function post(url: string, body: Record<string, unknown>): Promise<Response & { status: number }> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Response & { status: number };
}

describe('POST /api/client-logs — validation', () => {
  it('rejects a missing message', async () => {
    const base = await startApp();
    const res = await post(`${base}/api/client-logs`, {});
    expect(res.status).toBe(400);
  });

  it('rejects a blank message', async () => {
    const base = await startApp();
    const res = await post(`${base}/api/client-logs`, { message: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a message over the length limit', async () => {
    const base = await startApp();
    const res = await post(`${base}/api/client-logs`, { message: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/client-logs — logging disabled', () => {
  it('still returns 204 when LOGTAIL_SOURCE_TOKEN is not set', async () => {
    const base = await startApp();
    const res = await post(`${base}/api/client-logs`, { message: 'uncaught error' });
    expect(res.status).toBe(204);
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });
});

describe('POST /api/client-logs — logging enabled', () => {
  it('logs an info event tagged with source and userId', async () => {
    process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
    const base = await startApp();
    const res = await post(`${base}/api/client-logs`, {
      message: 'page loaded',
      context: { path: '/ledger' },
    });
    expect(res.status).toBe(204);
    expect(mockInfo).toHaveBeenCalledOnce();
    const [message, fields] = mockInfo.mock.calls[0];
    expect(message).toBe('page loaded');
    expect(fields.source).toBe('client');
    expect(fields.userId).toBe('user-123');
    expect(fields.path).toBe('/ledger');
    expect(mockError).not.toHaveBeenCalled();
  });

  it('routes level: "error" to logger.error', async () => {
    process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
    const base = await startApp();
    await post(`${base}/api/client-logs`, {
      level: 'error',
      message: 'uncaught error',
      context: { stack: 'Error: boom' },
    });
    expect(mockError).toHaveBeenCalledOnce();
    const [message, fields] = mockError.mock.calls[0];
    expect(message).toBe('uncaught error');
    expect(fields.stack).toBe('Error: boom');
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('redacts sensitive keys in context the same way requestLogger does', async () => {
    process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
    const base = await startApp();
    await post(`${base}/api/client-logs`, {
      message: 'debug event',
      context: { token: 'abc', keep: 1 },
    });
    const [, fields] = mockInfo.mock.calls[0];
    expect(fields.token).toBe('[REDACTED]');
    expect(fields.keep).toBe(1);
  });

  it('defaults to logger.info when level is omitted', async () => {
    process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
    const base = await startApp();
    await post(`${base}/api/client-logs`, { message: 'no level given' });
    expect(mockInfo).toHaveBeenCalledOnce();
    expect(mockError).not.toHaveBeenCalled();
  });
});
