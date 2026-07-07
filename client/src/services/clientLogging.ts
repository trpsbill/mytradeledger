// Forwards client-side telemetry to the server's /api/client-logs proxy, which
// relays it to Better Stack alongside request logs: uncaught errors/rejections
// for debugging, and clicks on interactive elements for support/usage tracking.
// Unlike GTM analytics this runs in local dev too, on purpose — that's where
// support most often needs to reproduce what a user clicked.

const API_BASE = '/api';
const TOKEN_KEY = 'mtl_token';

// Ancestors searched for a meaningful interactive element to attribute a click
// to, so a click on an icon/span inside a button is still logged as the button.
const INTERACTIVE_SELECTOR = 'a, button, [role="button"], input, select, [data-track]';

function logClientEvent(level: 'info' | 'error', message: string, context?: Record<string, unknown>): void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  // fetch + keepalive (not sendBeacon) so the Authorization header can ride
  // along — sendBeacon can't set custom headers, and requireAuth needs one.
  fetch(`${API_BASE}/client-logs`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ level, message, context }),
  }).catch(() => {});
}

function describeClickTarget(target: EventTarget | null): Record<string, unknown> | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(INTERACTIVE_SELECTOR) ?? target;

  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    text: el.textContent?.trim().slice(0, 100) || undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    href: el instanceof HTMLAnchorElement ? el.href : undefined,
    path: window.location.pathname,
  };
}

export function initClientLogging(): void {
  window.addEventListener('error', (event) => {
    logClientEvent('error', 'uncaught error', {
      message: event.message,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logClientEvent('error', 'unhandled rejection', { reason: String(event.reason) });
  });

  document.addEventListener('click', (event) => {
    const context = describeClickTarget(event.target);
    if (!context) return;
    const label = context.text || context.ariaLabel || context.tag;
    logClientEvent('info', `click - ${label}`, context);
  });
}
