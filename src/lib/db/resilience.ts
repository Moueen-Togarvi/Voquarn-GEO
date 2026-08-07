/**
 * A remote PostgreSQL connection can surface transient transport failures
 * while a Neon compute wakes or a connection is dropped. WebSocket paths may
 * throw a raw browser-style `ErrorEvent`; HTTP paths normally throw a standard
 * fetch Error. Normalize both shapes and retry briefly so callers receive a
 * useful error if retrying also fails.
 *
 * Pure — no Prisma import, so both functions are unit-testable without a
 * database. See src/lib/db.ts for where this wraps every query.
 */

function looksLikeErrorEvent(value: unknown): value is { type: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

/** True for errors worth a short bounded retry: cold/dropped connections, not real query errors. */
export function isTransientDbError(error: unknown): boolean {
  if (looksLikeErrorEvent(error)) return true;

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;
    return /websocket|fetch failed|connection.*(closed|reset|terminated)/i.test(
      error.message,
    );
  }

  return false;
}

/** Every query result passes through this before reaching a caller — guarantees callers only ever see a real Error with a real message, never a raw ErrorEvent or other non-Error throw. */
export function normalizeDbError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (looksLikeErrorEvent(error)) {
    return new Error(
      `Database connection error (${error.type}) — the connection was likely still cold or was dropped mid-query.`,
    );
  }

  return new Error(
    `Non-Error value thrown from a database query: ${String(error)}`,
  );
}
