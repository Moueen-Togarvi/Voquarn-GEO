import pino from "pino";

/**
 * Structured logger shared by route handlers (src/lib/api/handler.ts) and
 * Inngest functions (src/lib/inngest/middleware/logger.ts). Never log API
 * keys, ciphertext, tokens, cookies, or full LLM answers — log a snapshot
 * reference instead. See docs/events.md.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "voquarn-geo" },
  redact: {
    paths: [
      "*.apiKey",
      "*.secret",
      "*.token",
      "*.password",
      "*.ciphertext",
      "*.authorization",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    remove: true,
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
