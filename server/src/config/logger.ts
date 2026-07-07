import { Logtail } from '@logtail/node';

let logtail: Logtail | null = null;
let initialized = false;

export function getLogtail(): Logtail | null {
  if (initialized) return logtail;
  initialized = true;
  const token = process.env.LOGTAIL_SOURCE_TOKEN;
  if (!token) return null;
  const host = process.env.LOGTAIL_INGESTING_HOST;
  const endpoint = host
    ? host.startsWith('http') ? host : `https://${host}`
    : undefined;
  logtail = new Logtail(token, endpoint ? { endpoint } : undefined);
  return logtail;
}

/** Test-only: reset the cached instance so env changes take effect between tests. */
export function __resetLogtailForTests(): void {
  logtail = null;
  initialized = false;
}
