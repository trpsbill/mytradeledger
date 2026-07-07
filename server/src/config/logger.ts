type LogFields = Record<string, unknown>;

interface StructuredLogger {
  info(message: string, fields?: LogFields): Promise<void>;
  error(message: string, fields?: LogFields): Promise<void>;
}

function write(level: 'info' | 'error', message: string, fields?: LogFields): Promise<void> {
  // eslint-disable-next-line no-console
  console[level](JSON.stringify({ level, message, ...fields, timestamp: new Date().toISOString() }));
  return Promise.resolve();
}

export function getLogger(): StructuredLogger {
  return {
    info: (message, fields) => write('info', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
