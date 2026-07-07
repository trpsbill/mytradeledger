import { Request, Response } from 'express';
import { billingService, FREE_LIMIT } from '../services/billingService';
import prisma from '../db';

export const billingController = {
  async getStatus(req: Request, res: Response) {
    const userId = req.user!.userId;
    const [user, tradeCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { isPaid: true, hasHitFreeLimit: true, stripeSubscriptionId: true },
      }),
      prisma.ledgerEntry.count({ where: { account: { userId, isDemo: false } } }),
    ]);

    return res.json({
      data: {
        isPaid: user?.isPaid ?? false,
        hasHitFreeLimit: user?.hasHitFreeLimit ?? false,
        tradeCount,
        limit: FREE_LIMIT,
        hasSubscription: !!user?.stripeSubscriptionId,
      },
    });
  },

  async createCheckoutSession(req: Request, res: Response) {
    const { plan, gaClientId } = req.body as { plan?: unknown; gaClientId?: unknown };
    if (plan !== 'monthly' && plan !== 'yearly') {
      return res.status(400).json({ error: 'plan must be "monthly" or "yearly"' });
    }
    const clientId = typeof gaClientId === 'string' && gaClientId.trim() ? gaClientId.trim() : undefined;

    try {
      const url = await billingService.createCheckoutSession(req.user!.userId, plan, clientId);
      return res.json({ data: { url } });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'ALREADY_SUBSCRIBED') {
        return res.status(400).json({ error: 'You already have an active subscription' });
      }
      console.error('[billing] createCheckoutSession error:', msg);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  },

  async cancelSubscription(req: Request, res: Response) {
    const { reason } = req.body as { reason?: unknown };
    const cancelReason = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
    try {
      await billingService.cancelSubscription(req.user!.userId, cancelReason);
      return res.json({ ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'NO_SUBSCRIPTION') {
        return res.status(400).json({ error: 'No active subscription to cancel' });
      }
      console.error('[billing] cancelSubscription error:', msg);
      return res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  },

  async createPortalSession(req: Request, res: Response) {
    try {
      const url = await billingService.createPortalSession(req.user!.userId);
      return res.json({ data: { url } });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'NO_CUSTOMER') {
        return res.status(400).json({ error: 'No billing account found' });
      }
      console.error('[billing] createPortalSession error:', msg);
      return res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  },

  async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      await billingService.handleWebhook(req.body as Buffer, signature);
      return res.json({ received: true });
    } catch (err) {
      const msg = (err as Error).message;
      console.error('[billing] webhook error:', msg);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
  },
};
