// Unit tests for billingService.handleWebhook.
// Stripe SDK and Prisma are mocked; no network or DB calls are made.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLogtailForTests } from '../config/logger';

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';

const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockUpdateMany = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 1 }));
const mockFindFirst = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockFindUniqueOrThrow = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockBillingPortalCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal/test' }),
);
const mockCheckoutSessionsCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session/test' }),
);
const mockSubscriptionsRetrieve = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ items: { data: [{ price: { recurring: { interval: 'month' } } }] } }),
);
const mockLogInfo = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendMeasurementProtocolEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    billingPortal: { sessions: { create: mockBillingPortalCreate } },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
}));

vi.mock('../db', () => ({
  default: {
    user: {
      updateMany: mockUpdateMany,
      findFirst: mockFindFirst,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUserUpdate,
    },
  },
}));

vi.mock('./email', () => ({
  sendSubscriptionConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionCancellationEmail: vi.fn().mockResolvedValue(undefined),
  sendCancellationAdminNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./ga4', () => ({
  sendMeasurementProtocolEvent: mockSendMeasurementProtocolEvent,
}));

// Mock @logtail/node so no real HTTP calls are made
vi.mock('@logtail/node', () => ({
  Logtail: vi.fn().mockImplementation(() => ({ info: mockLogInfo, error: vi.fn().mockResolvedValue(undefined) })),
}));

import { billingService } from './billingService';

const FAKE_RAW = Buffer.from('fake-stripe-payload');
const FAKE_SIG = 'fake-signature';

// Fire-and-forget chains (email, GA4) aren't awaited by handleWebhook itself —
// flush the microtask queue so they've settled before assertions run.
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

async function dispatchWebhook(type: string, obj: object) {
  mockConstructEvent.mockReturnValueOnce({ id: 'evt_test123', type, data: { object: obj } });
  await billingService.handleWebhook(FAKE_RAW, FAKE_SIG);
  await flushPromises();
}

beforeEach(() => {
  mockUpdateMany.mockClear();
  mockFindFirst.mockClear();
  mockFindUniqueOrThrow.mockReset();
  mockUserUpdate.mockClear();
  mockBillingPortalCreate.mockClear();
  mockCheckoutSessionsCreate.mockClear();
  mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session/test' });
  mockSubscriptionsRetrieve.mockClear();
  mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { recurring: { interval: 'month' } } }] } });
  mockLogInfo.mockClear();
  mockSendMeasurementProtocolEvent.mockClear();
  process.env.LOGTAIL_SOURCE_TOKEN = 'test-token';
  process.env.STRIPE_PRICE_MONTHLY = 'price_monthly';
  process.env.STRIPE_PRICE_YEARLY = 'price_yearly';
  process.env.STRIPE_SUCCESS_URL = 'http://localhost:5173/app/settings/account?payment=success';
  process.env.STRIPE_CANCEL_URL = 'http://localhost:5173/app/ledger';
  __resetLogtailForTests();
});

afterEach(() => {
  delete process.env.LOGTAIL_SOURCE_TOKEN;
  __resetLogtailForTests();
});

describe('handleWebhook — checkout.session.completed', () => {
  it('sets isPaid=true and stores the subscription ID', async () => {
    await dispatchWebhook('checkout.session.completed', {
      customer: 'cus_abc',
      subscription: 'sub_xyz',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: true, stripeSubscriptionId: 'sub_xyz' },
    });
  });
});

describe('handleWebhook — customer.subscription.updated', () => {
  it('sets isPaid=true for active status', async () => {
    await dispatchWebhook('customer.subscription.updated', {
      id: 'sub_xyz',
      customer: 'cus_abc',
      status: 'active',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: true, stripeSubscriptionId: 'sub_xyz' },
    });
  });

  it('sets isPaid=true for trialing status', async () => {
    await dispatchWebhook('customer.subscription.updated', {
      id: 'sub_xyz',
      customer: 'cus_abc',
      status: 'trialing',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: true, stripeSubscriptionId: 'sub_xyz' },
    });
  });

  it('sets isPaid=false for canceled status', async () => {
    await dispatchWebhook('customer.subscription.updated', {
      id: 'sub_xyz',
      customer: 'cus_abc',
      status: 'canceled',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: false, stripeSubscriptionId: 'sub_xyz' },
    });
  });

  it('sets isPaid=false for unpaid status', async () => {
    await dispatchWebhook('customer.subscription.updated', {
      id: 'sub_xyz',
      customer: 'cus_abc',
      status: 'unpaid',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: false, stripeSubscriptionId: 'sub_xyz' },
    });
  });
});

describe('handleWebhook — customer.subscription.deleted', () => {
  it('sets isPaid=false and clears stripeSubscriptionId', async () => {
    await dispatchWebhook('customer.subscription.deleted', { customer: 'cus_abc' });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_abc' },
      data: { isPaid: false, stripeSubscriptionId: null },
    });
  });
});

describe('handleWebhook — invoice.payment_failed', () => {
  it('does NOT revoke access (no isPaid update)', async () => {
    await dispatchWebhook('invoice.payment_failed', { customer: 'cus_abc' });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe('handleWebhook — Better Stack logging', () => {
  it('logs a new subscriber on checkout.session.completed', async () => {
    await dispatchWebhook('checkout.session.completed', { customer: 'cus_abc', subscription: 'sub_xyz' });

    expect(mockLogInfo).toHaveBeenCalledOnce();
    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('stripe: new subscriber');
    expect(fields).toMatchObject({
      source: 'server',
      event: 'checkout.session.completed',
      stripeEventId: 'evt_test123',
      customerId: 'cus_abc',
      subscriptionId: 'sub_xyz',
    });
  });

  it('logs subscription status changes on customer.subscription.updated', async () => {
    await dispatchWebhook('customer.subscription.updated', { id: 'sub_xyz', customer: 'cus_abc', status: 'active' });

    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('stripe: subscription updated');
    expect(fields).toMatchObject({ customerId: 'cus_abc', subscriptionId: 'sub_xyz', status: 'active' });
  });

  it('logs cancellations on customer.subscription.deleted', async () => {
    await dispatchWebhook('customer.subscription.deleted', { customer: 'cus_abc' });

    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('stripe: subscription cancelled');
    expect(fields).toMatchObject({ customerId: 'cus_abc' });
  });

  it('logs invoice.payment_failed', async () => {
    await dispatchWebhook('invoice.payment_failed', { customer: 'cus_abc' });

    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('stripe: payment failed');
    expect(fields).toMatchObject({ customerId: 'cus_abc' });
  });

  it('still logs event types it does not otherwise act on', async () => {
    await dispatchWebhook('payment_intent.succeeded', { id: 'pi_123' });

    expect(mockUpdateMany).not.toHaveBeenCalled();
    const [message, fields] = mockLogInfo.mock.calls[0];
    expect(message).toBe('stripe: unhandled event');
    expect(fields).toMatchObject({ event: 'payment_intent.succeeded', stripeEventId: 'evt_test123' });
  });

  it('does not log when LOGTAIL_SOURCE_TOKEN is not set', async () => {
    delete process.env.LOGTAIL_SOURCE_TOKEN;
    __resetLogtailForTests();
    await dispatchWebhook('checkout.session.completed', { customer: 'cus_abc', subscription: 'sub_xyz' });
    expect(mockLogInfo).not.toHaveBeenCalled();
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      isPaid: false,
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: null,
    });
  });

  it('sets client_reference_id when a GA4 client id is provided', async () => {
    await billingService.createCheckoutSession('user_1', 'monthly', 'client123.456');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: 'client123.456' })
    );
  });

  it('omits client_reference_id when no GA4 client id is provided', async () => {
    await billingService.createCheckoutSession('user_1', 'monthly');

    const [args] = mockCheckoutSessionsCreate.mock.calls[0];
    expect(args).not.toHaveProperty('client_reference_id');
  });
});

describe('handleWebhook — GA4 new_subscriber event', () => {
  it('sends the event using the recovered client_reference_id, amount, currency and interval', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ price: { recurring: { interval: 'year' } } }] },
    });

    await dispatchWebhook('checkout.session.completed', {
      customer: 'cus_abc',
      subscription: 'sub_xyz',
      amount_total: 4800,
      currency: 'usd',
      client_reference_id: 'client123.456',
    });

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_xyz', { expand: ['items.data.price'] });
    expect(mockSendMeasurementProtocolEvent).toHaveBeenCalledWith('client123.456', {
      name: 'new_subscriber',
      params: { currency: 'USD', value: 48, plan: 'yearly', transaction_id: 'sub_xyz' },
    });
  });

  it('reports plan as monthly for a month interval', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
    });

    await dispatchWebhook('checkout.session.completed', {
      customer: 'cus_abc',
      subscription: 'sub_xyz',
      amount_total: 500,
      currency: 'usd',
      client_reference_id: 'client123.456',
    });

    expect(mockSendMeasurementProtocolEvent).toHaveBeenCalledWith('client123.456', {
      name: 'new_subscriber',
      params: { currency: 'USD', value: 5, plan: 'monthly', transaction_id: 'sub_xyz' },
    });
  });

  it('does not send a GA4 event when no client_reference_id was recovered', async () => {
    await dispatchWebhook('checkout.session.completed', {
      customer: 'cus_abc',
      subscription: 'sub_xyz',
      amount_total: 500,
      currency: 'usd',
      client_reference_id: null,
    });

    expect(mockSendMeasurementProtocolEvent).not.toHaveBeenCalled();
  });

  it('still updates isPaid even if resolving the subscription interval fails', async () => {
    mockSubscriptionsRetrieve.mockRejectedValue(new Error('stripe down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await dispatchWebhook('checkout.session.completed', {
      customer: 'cus_abc',
      subscription: 'sub_xyz',
      amount_total: 500,
      currency: 'usd',
      client_reference_id: 'client123.456',
    });

    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockSendMeasurementProtocolEvent).toHaveBeenCalledWith('client123.456', {
      name: 'new_subscriber',
      params: { currency: 'USD', value: 5, plan: 'monthly', transaction_id: 'sub_xyz' },
    });
    errorSpy.mockRestore();
  });
});
