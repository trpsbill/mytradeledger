// Server-side GA4 Measurement Protocol client — used to send reliable,
// non-client-dependent events (e.g. a confirmed subscription) that shouldn't
// depend on the browser tab staying open. Safe no-op if GA4 credentials
// aren't configured.

const MEASUREMENT_PROTOCOL_URL = 'https://www.google-analytics.com/mp/collect';

interface Ga4Event {
  name: string;
  params?: Record<string, unknown>;
}

export async function sendMeasurementProtocolEvent(clientId: string, event: Ga4Event): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret || !clientId) return;

  const url = `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: event.name, params: event.params }],
      }),
    });
    if (!res.ok) {
      console.error('[ga4] measurement protocol request failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[ga4] measurement protocol request error:', err);
  }
}
