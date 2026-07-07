import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGa4ClientId, initAnalytics, trackEvent, trackPageView } from './analytics';

// In test / dev mode import.meta.env.PROD is false, so GTM_ID is always undefined.
// initAnalytics() is therefore a guaranteed no-op — we verify that here and test
// the tracking helpers by stubbing window.dataLayer directly.

beforeEach(() => {
  delete (window as Partial<Window>).dataLayer;
  document.head.querySelectorAll('script[src*="googletagmanager"]').forEach(s => s.remove());
  document.querySelectorAll('noscript').forEach(n => n.remove());
});

describe('initAnalytics', () => {
  it('does not inject a script or populate dataLayer in non-prod builds', () => {
    initAnalytics();
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe('trackPageView', () => {
  it('is a no-op when GTM_ID is not set (non-prod)', () => {
    expect(() => trackPageView('/some/path')).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe('trackEvent', () => {
  it('is a no-op when GTM_ID is not set (non-prod)', () => {
    expect(() => trackEvent('sign_up')).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  it('is a no-op with params when GTM_ID is not set (non-prod)', () => {
    expect(() => trackEvent('begin_checkout', { plan: 'yearly' })).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe('getGa4ClientId', () => {
  afterEach(() => {
    document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
  });

  it('returns undefined when no _ga cookie is set', () => {
    expect(getGa4ClientId()).toBeUndefined();
  });

  it('extracts the client_id from a standard _ga cookie', () => {
    document.cookie = '_ga=GA1.1.111111111.222222222';
    expect(getGa4ClientId()).toBe('111111111.222222222');
  });

  it('extracts the client_id when other cookies are present', () => {
    document.cookie = 'session=abc123';
    document.cookie = '_ga=GA1.1.111111111.222222222';
    document.cookie = 'other=xyz';
    expect(getGa4ClientId()).toBe('111111111.222222222');
  });

  it('returns undefined for a malformed _ga cookie', () => {
    document.cookie = '_ga=not-enough-parts';
    expect(getGa4ClientId()).toBeUndefined();
  });
});
