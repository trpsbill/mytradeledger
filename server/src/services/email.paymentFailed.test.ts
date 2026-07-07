import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendPaymentFailedEmail } from './email';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('node-mailjet', () => ({
  default: vi.fn().mockImplementation(() => ({
    post: vi.fn().mockReturnValue({ request: mockRequest }),
  })),
}));

describe('sendPaymentFailedEmail copy', () => {
  beforeEach(() => {
    process.env.MJ_APIKEY_PUBLIC = 'test-key';
    process.env.MJ_APIKEY_PRIVATE = 'test-secret';
    process.env.MJ_FROM_EMAIL = 'noreply@example.com';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not tell the customer their account was downgraded', async () => {
    await sendPaymentFailedEmail({ email: 'user@example.com' }, 'https://portal.example.com');

    expect(mockRequest).toHaveBeenCalledOnce();
    const payload = mockRequest.mock.calls[0][0] as {
      Messages: Array<{ TextPart: string; HTMLPart: string }>;
    };
    const { TextPart, HTMLPart } = payload.Messages[0];

    expect(TextPart).not.toMatch(/downgraded/i);
    expect(TextPart).not.toMatch(/free plan/i);
    expect(HTMLPart).not.toMatch(/downgraded/i);
    expect(HTMLPart).not.toMatch(/free plan/i);
  });

  it('informs the customer their Pro access is not yet interrupted', async () => {
    await sendPaymentFailedEmail({ email: 'user@example.com' }, 'https://portal.example.com');

    const payload = mockRequest.mock.calls[0][0] as {
      Messages: Array<{ TextPart: string; HTMLPart: string }>;
    };
    const { TextPart, HTMLPart } = payload.Messages[0];

    expect(TextPart).toMatch(/Pro access/i);
    expect(HTMLPart).toMatch(/Pro access/i);
  });
});
