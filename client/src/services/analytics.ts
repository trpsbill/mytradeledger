/// <reference types="vite/client" />
// GTM analytics — only active in production builds.
// GA4 is loaded and managed through GTM, not hard-coded here.
// All exported functions are safe no-ops in dev/test.

const GTM_ID = import.meta.env.PROD ? 'GTM-58ZZNPMV' : undefined;

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export function initAnalytics(): void {
  if (!GTM_ID) return;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  // Inject GTM loader script as the first child of <head>
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.insertBefore(script, document.head.firstChild);

  // Inject <noscript> GTM fallback at the start of <body>
  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.cssText = 'display:none;visibility:hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
}

export function trackPageView(path: string): void {
  if (!GTM_ID) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: 'page_view',
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GTM_ID) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: name, ...params });
}

// Reads the GA4 client_id out of the `_ga` cookie GA sets itself
// (format: GA1.1.<part1>.<part2>, client_id is "<part1>.<part2>").
// Used to thread a client_id through to the server so a webhook-driven
// event can still be attributed to this browser after redirecting to Stripe.
export function getGa4ClientId(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!match) return undefined;
  const parts = match[1].split('.');
  if (parts.length < 4) return undefined;
  return `${parts[2]}.${parts[3]}`;
}
