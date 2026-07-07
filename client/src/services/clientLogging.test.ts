import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initClientLogging } from './clientLogging';

function clickOn(el: HTMLElement): void {
  document.body.appendChild(el);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('initClientLogging', () => {
  // The listeners are global (window/document) and not disposable, so register
  // them once — calling initClientLogging() per-test would stack duplicate
  // listeners and double-fire every event.
  beforeAll(() => {
    initClientLogging();
  });

  beforeEach(() => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    localStorage.setItem('mtl_token', 'test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('does not send anything when no auth token is present', () => {
    localStorage.clear();
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('posts an uncaught error with Authorization and keepalive', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }));

    expect(window.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(window.fetch).mock.calls[0];
    expect(url).toBe('/api/client-logs');
    expect(options?.keepalive).toBe(true);
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');

    const body = JSON.parse(options?.body as string);
    expect(body.level).toBe('error');
    expect(body.message).toBe('uncaught error');
    expect(body.context.message).toBe('boom');
  });

  it('posts an unhandled rejection', () => {
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject().catch(() => {}),
        reason: 'nope',
      })
    );

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.level).toBe('error');
    expect(body.message).toBe('unhandled rejection');
    expect(body.context.reason).toBe('nope');
  });

  it('logs a click on a button, with a message describing what was clicked', () => {
    const button = document.createElement('button');
    button.textContent = 'Delete entry';
    clickOn(button);

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.level).toBe('info');
    expect(body.message).toBe('click - Delete entry');
    expect(body.context.tag).toBe('button');
    expect(body.context.text).toBe('Delete entry');
  });

  it('logs a click on a link, capturing the href and describing it by link text', () => {
    const link = document.createElement('a');
    link.href = '/ledger';
    link.textContent = 'Ledger';
    clickOn(link);

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.message).toBe('click - Ledger');
    expect(body.context.tag).toBe('a');
    expect(body.context.href).toContain('/ledger');
  });

  it('attributes a click on a nested icon/span to its interactive button ancestor, using aria-label for the message', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Close modal');
    const icon = document.createElement('span');
    button.appendChild(icon);
    document.body.appendChild(button);
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.message).toBe('click - Close modal');
    expect(body.context.tag).toBe('button');
    expect(body.context.ariaLabel).toBe('Close modal');
  });

  it('falls back to the tag name for the message when a plain element has no text or aria-label', () => {
    const div = document.createElement('div');
    clickOn(div);

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.message).toBe('click - div');
    expect(body.context.tag).toBe('div');
  });

  it('still logs a click on a plain, non-interactive element with text', () => {
    const div = document.createElement('div');
    div.textContent = 'not a button';
    clickOn(div);

    const [, options] = vi.mocked(window.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.message).toBe('click - not a button');
    expect(body.context.tag).toBe('div');
  });
});
