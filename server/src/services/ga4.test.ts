// Unit tests for the GA4 Measurement Protocol helper. global fetch is mocked;
// no network calls are made.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMeasurementProtocolEvent } from './ga4';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
  vi.stubGlobal('fetch', mockFetch);
  delete process.env.GA4_MEASUREMENT_ID;
  delete process.env.GA4_API_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendMeasurementProtocolEvent', () => {
  it('is a no-op when GA4_MEASUREMENT_ID/GA4_API_SECRET are unset', async () => {
    await sendMeasurementProtocolEvent('client123.456', { name: 'new_subscriber' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('is a no-op when clientId is empty', async () => {
    process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
    process.env.GA4_API_SECRET = 'secret';
    await sendMeasurementProtocolEvent('', { name: 'new_subscriber' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts the event to the Measurement Protocol endpoint when configured', async () => {
    process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
    process.env.GA4_API_SECRET = 'secret';

    await sendMeasurementProtocolEvent('client123.456', {
      name: 'new_subscriber',
      params: { currency: 'USD', value: 5, plan: 'monthly' },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=secret');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      client_id: 'client123.456',
      events: [{ name: 'new_subscriber', params: { currency: 'USD', value: 5, plan: 'monthly' } }],
    });
  });

  it('logs but does not throw when the request fails', async () => {
    process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
    process.env.GA4_API_SECRET = 'secret';
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad request') });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendMeasurementProtocolEvent('client123.456', { name: 'new_subscriber' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs but does not throw when fetch rejects', async () => {
    process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
    process.env.GA4_API_SECRET = 'secret';
    mockFetch.mockRejectedValue(new Error('network down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendMeasurementProtocolEvent('client123.456', { name: 'new_subscriber' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
