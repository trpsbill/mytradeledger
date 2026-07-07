import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyUser, track } from './betterstack';

describe('identifyUser', () => {
  afterEach(() => {
    delete (window as Partial<Window>).betterstack;
  });

  it('calls window.betterstack("user", ...) with id, email, and mapped plan', () => {
    window.betterstack = vi.fn();
    identifyUser({ id: 'user-123', email: 'a@b.com', isPaid: true });

    expect(window.betterstack).toHaveBeenCalledWith('user', {
      id: 'user-123',
      email: 'a@b.com',
      plan: 'premium',
    });
  });

  it('maps isPaid=false to plan: "free"', () => {
    window.betterstack = vi.fn();
    identifyUser({ id: 'user-456', email: 'c@d.com', isPaid: false });

    expect(window.betterstack).toHaveBeenCalledWith('user', {
      id: 'user-456',
      email: 'c@d.com',
      plan: 'free',
    });
  });

  it('is a no-op (does not throw) when the snippet has not loaded window.betterstack yet', () => {
    expect(() => identifyUser({ id: 'user-789', email: 'e@f.com', isPaid: false })).not.toThrow();
  });
});

describe('track', () => {
  afterEach(() => {
    delete (window as Partial<Window>).betterstack;
  });

  it('calls window.betterstack("track", name, properties)', () => {
    window.betterstack = vi.fn();
    track('signup', { userId: 'user-123', email: 'a@b.com' });

    expect(window.betterstack).toHaveBeenCalledWith('track', 'signup', {
      userId: 'user-123',
      email: 'a@b.com',
    });
  });

  it('allows omitting properties', () => {
    window.betterstack = vi.fn();
    track('subscribe');

    expect(window.betterstack).toHaveBeenCalledWith('track', 'subscribe', undefined);
  });

  it('is a no-op (does not throw) when the snippet has not loaded window.betterstack yet', () => {
    expect(() => track('signup', { userId: 'user-789' })).not.toThrow();
  });
});
