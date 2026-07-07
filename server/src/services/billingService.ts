import Stripe from 'stripe';
import prisma from '../db';
import { sendSubscriptionConfirmationEmail, sendPaymentFailedEmail, sendSubscriptionCancellationEmail, sendCancellationAdminNotification } from './email';
import { getLogtail } from '../config/logger';
import { sendMeasurementProtocolEvent } from './ga4';

export const FREE_LIMIT = 25;
export const FREE_IMPORT_CAP = 10;

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// The Checkout Session itself doesn't carry the billing interval — resolve it
// from the subscription's price so the GA4 event can report monthly vs. yearly.
async function resolveSubscriptionInterval(subscriptionId: string): Promise<string | null> {
  const subscription = await stripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  return subscription.items.data[0]?.price?.recurring?.interval ?? null;
}

export const billingService = {
  async getUserTradeCount(userId: string): Promise<number> {
    return prisma.ledgerEntry.count({
      where: { account: { userId } },
    });
  },

  async createCheckoutSession(userId: string, plan: 'monthly' | 'yearly', gaClientId?: string): Promise<string> {
    const priceId =
      plan === 'yearly'
        ? process.env.STRIPE_PRICE_YEARLY!
        : process.env.STRIPE_PRICE_MONTHLY!;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.isPaid && user.stripeSubscriptionId) {
      throw new Error('ALREADY_SUBSCRIBED');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.STRIPE_SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      subscription_data: { metadata: { userId } },
      // Carries the GA4 client_id through to the checkout.session.completed
      // webhook so the server-side new_subscriber event can be attributed
      // back to the browser session that started checkout.
      ...(gaClientId ? { client_reference_id: gaClientId } : {}),
    });

    return session.url!;
  },

  async createPortalSession(userId: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.stripeCustomerId) throw new Error('NO_CUSTOMER');
    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_BASE_URL}/app/settings/account`,
    });
    return session.url;
  },

  async cancelSubscription(userId: string, reason?: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.stripeSubscriptionId) throw new Error('NO_SUBSCRIPTION');

    // Schedule cancellation at period end — access continues until then.
    // isPaid stays true; the customer.subscription.deleted webhook clears it.
    await stripe().subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    sendSubscriptionCancellationEmail(user, reason).catch(err =>
      console.error('[billing] cancellation email failed:', err)
    );
    sendCancellationAdminNotification(user, reason).catch(err =>
      console.error('[billing] cancellation admin notification failed:', err)
    );
  },

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = stripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    const logtail = getLogtail();
    const logEvent = (message: string, extra?: Record<string, unknown>) => {
      logtail?.info(message, {
        source: 'server',
        event: event.type,
        stripeEventId: event.id,
        ...extra,
      }).catch(() => {});
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const obj = event.data.object as {
          customer: string;
          subscription: string;
          amount_total: number | null;
          currency: string | null;
          client_reference_id: string | null;
        };
        await prisma.user.updateMany({
          where: { stripeCustomerId: obj.customer },
          data: { isPaid: true, stripeSubscriptionId: obj.subscription },
        });
        logEvent('stripe: new subscriber', {
          customerId: obj.customer,
          subscriptionId: obj.subscription,
          amountTotal: obj.amount_total,
          currency: obj.currency,
        });
        // Fire-and-forget confirmation email — don't let a send failure fail the webhook
        prisma.user.findFirst({ where: { stripeCustomerId: obj.customer }, select: { email: true } })
          .then(user => { if (user) sendSubscriptionConfirmationEmail(user).catch(err => console.error('[billing] confirmation email failed:', err)); })
          .catch(err => console.error('[billing] user lookup for confirmation email failed:', err));
        // Fire-and-forget GA4 server-side event — only possible if the client
        // threaded its GA4 client_id through as client_reference_id at checkout.
        if (obj.client_reference_id) {
          resolveSubscriptionInterval(obj.subscription)
            .catch(err => {
              console.error('[billing] failed to resolve subscription interval:', err);
              return null;
            })
            .then(interval =>
              sendMeasurementProtocolEvent(obj.client_reference_id!, {
                name: 'new_subscriber',
                params: {
                  currency: (obj.currency ?? 'usd').toUpperCase(),
                  value: obj.amount_total != null ? obj.amount_total / 100 : undefined,
                  plan: interval === 'year' ? 'yearly' : 'monthly',
                  transaction_id: obj.subscription,
                },
              })
            )
            .catch(err => console.error('[billing] GA4 new_subscriber event failed:', err));
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as { id: string; customer: string; status: string };
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer },
          data: { isPaid: isActive, stripeSubscriptionId: sub.id },
        });
        logEvent('stripe: subscription updated', { customerId: sub.customer, subscriptionId: sub.id, status: sub.status });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as { customer: string };
        await prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer },
          data: { isPaid: false, stripeSubscriptionId: null },
        });
        logEvent('stripe: subscription cancelled', { customerId: sub.customer });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as { customer: string };
        logEvent('stripe: payment failed', { customerId: inv.customer });
        // Do NOT revoke access here — Stripe dunning will retry over several days.
        // Access is revoked by customer.subscription.updated when status → unpaid/canceled.
        // Just notify the user so they can update their payment method.
        prisma.user.findFirst({ where: { stripeCustomerId: inv.customer }, select: { email: true, stripeCustomerId: true } })
          .then(async user => {
            if (!user) return;
            try {
              const portalSession = await stripe().billingPortal.sessions.create({
                customer: user.stripeCustomerId!,
                return_url: `${process.env.APP_BASE_URL}/app/settings/account`,
              });
              sendPaymentFailedEmail(user, portalSession.url).catch(err =>
                console.error('[billing] payment failed email error:', err)
              );
            } catch (err) {
              console.error('[billing] could not create portal session for payment failed email:', err);
            }
          })
          .catch(err => console.error('[billing] user lookup for payment failed email failed:', err));
        break;
      }
      default:
        // Still log unrecognized event types so nothing Stripe sends is invisible,
        // even though we don't act on it.
        logEvent('stripe: unhandled event');
    }
  },
};
