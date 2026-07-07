import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../config/logger';

const REDACT_PATTERNS = ['password', 'token', 'secret', 'authorization', 'apikey'];

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_PATTERNS.some(p => lower.includes(p));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item));
  if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = shouldRedact(k) ? '[REDACTED]' : sanitizeValue(v);
  }
  return out;
}

export function sanitizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) return null;
  const result = sanitizeObject(body as Record<string, unknown>);
  return Object.keys(result).length > 0 ? result : null;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();
  // Capture before Express strips the mount prefix during sub-router dispatch
  const originalPath = req.originalUrl.split('?')[0];
  const requestId = randomUUID();
  res.locals.requestId = requestId;

  res.on('finish', () => {
    const logger = getLogger();

    const statusCode = res.statusCode;
    const durationMs = Date.now() - startMs;
    const route = req.baseUrl + (req.route?.path ?? req.path);
    const message = `${req.method} ${originalPath} ${statusCode}`;

    const errorInfo = res.locals.error as { message: string; stack?: string } | undefined;

    const fields: Record<string, unknown> = {
      requestId,
      userId: req.user?.userId ?? null,
      route,
      method: req.method,
      statusCode,
      durationMs,
      error: statusCode >= 500
        ? (errorInfo ?? { message: 'Internal server error' })
        : false,
    };

    if (req.params?.id) {
      fields.resourceId = req.params.id;
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const sanitized = sanitizeBody(req.body);
      if (sanitized) fields.body = sanitized;
    }

    if (statusCode >= 500) {
      logger.error(message, fields).catch(() => {});
    } else {
      logger.info(message, fields).catch(() => {});
    }
  });

  next();
}
