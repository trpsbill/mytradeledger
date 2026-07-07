import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import { FREE_LIMIT } from '../services/billingService';

export async function requirePaid(req: Request, res: Response, next: NextFunction) {
  // Fast path: JWT already reflects paid status
  if (req.user!.isPaid) return next();

  // Check DB for both isPaid (may have been updated by webhook since JWT was issued)
  // and entry count in one query.
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      isPaid: true,
      hasHitFreeLimit: true,
      accounts: {
        where: { isDemo: false },
        select: { _count: { select: { ledgerEntries: true } } },
      },
    },
  });

  if (!user) return res.status(401).json({ error: 'User not found' });

  // Webhook may have updated isPaid since JWT was issued
  if (user.isPaid) return next();

  // Once a user has hit the limit, block regardless of current entry count
  // (prevents bypassing by deleting entries then re-adding)
  if (user.hasHitFreeLimit) {
    const total = user.accounts.reduce((sum, a) => sum + a._count.ledgerEntries, 0);
    return res.status(402).json({ error: 'FREE_LIMIT_REACHED', current: total, limit: FREE_LIMIT });
  }

  const total = user.accounts.reduce((sum, a) => sum + a._count.ledgerEntries, 0);
  if (total >= FREE_LIMIT) {
    return res.status(402).json({ error: 'FREE_LIMIT_REACHED', current: total, limit: FREE_LIMIT });
  }

  return next();
}
