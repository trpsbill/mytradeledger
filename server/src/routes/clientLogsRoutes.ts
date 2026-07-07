import { Router } from 'express';
import type { Request, Response } from 'express';
import { getLogtail } from '../config/logger';
import { sanitizeBody } from '../middleware/requestLogger';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

// Higher ceiling than other authRateLimit uses (e.g. support email at 5/15min):
// this endpoint now also carries per-click usage-tracking events, not just
// sparse error reports, so normal browsing can plausibly send dozens/minute.
const clientLogsLimiter = authRateLimit('client-logs', {
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many log events. Please try again later.' },
});

const MAX_MESSAGE_LENGTH = 2000;

router.post('/', clientLogsLimiter, (req: Request, res: Response) => {
  const { level, message, context } = req.body as { level?: unknown; message?: unknown; context?: unknown };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
  }

  const logtail = getLogtail();
  const sanitizedContext = sanitizeBody(context);
  const fields: Record<string, unknown> = {
    source: 'client',
    userId: req.user!.userId,
    ...(sanitizedContext ?? {}),
  };

  const method = level === 'error' ? 'error' : 'info';
  logtail?.[method](message, fields).catch(() => {});

  return res.status(204).end();
});

export default router;
