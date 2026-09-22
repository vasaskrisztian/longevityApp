/**
 * Structured logger with a redaction ALLOWLIST, not a denylist — see
 * ARCHITECTURE.md §57. It is far safer to only ever print fields we
 * explicitly named than to try to remember every sensitive field name.
 *
 * Never pass token, password, or raw provider-payload fields into `fields`.
 */

type LogFields = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEY_PATTERN =
  /token|password|secret|refresh|authorization|cookie|payload/i;

function sanitize(fields: LogFields): LogFields {
  const clean: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      // Defense in depth: even an accidental pass-through gets redacted
      // rather than printed, instead of throwing and dropping the whole log.
      clean[key] = '[redacted]';
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function emit(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(fields),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
