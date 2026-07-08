import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRateLimit } from '../middleware/rateLimit';
import { sendSupportEmail } from '../services/email';

const router = Router();

const supportLimiter = authRateLimit('support', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many support requests. Please try again later.' },
});

router.post('/', supportLimiter, async (req: Request, res: Response) => {
  const { subject, message } = req.body as { subject?: unknown; message?: unknown };

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    return res.status(400).json({ error: 'Subject is required' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (subject.trim().length > 200) {
    return res.status(400).json({ error: 'Subject must be 200 characters or fewer' });
  }
  if (message.trim().length > 5000) {
    return res.status(400).json({ error: 'Message must be 5000 characters or fewer' });
  }

  try {
    await sendSupportEmail({
      fromEmail: req.user!.email,
      userId: req.user!.userId,
      subject: subject.trim(),
      message: message.trim(),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send support request. Please try again.' });
  }

  return res.status(204).end();
});

export default router;
