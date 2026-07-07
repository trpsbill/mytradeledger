// Identifies the signed-in user to the Better Stack browser snippet loaded in
// index.html. window.betterstack is a queueing stub installed synchronously by
// that inline script, so it's always safe to call even before the real script
// has finished loading.

declare global {
  interface Window {
    betterstack?: (...args: unknown[]) => void;
  }
}

export interface IdentifiableUser {
  id: string;
  email: string;
  isPaid: boolean;
}

export function identifyUser(user: IdentifiableUser): void {
  window.betterstack?.('user', {
    id: user.id,
    email: user.email,
    plan: user.isPaid ? 'premium' : 'free',
  });
}

export function track(name: string, properties?: Record<string, unknown>): void {
  window.betterstack?.('track', name, properties);
}
