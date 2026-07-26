/** Shared retry + timeout helpers for engine adapters. */

export const ENGINE_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

export class EngineTimeoutError extends Error {
  constructor(engine: string) {
    super(`${engine} request timed out after ${ENGINE_TIMEOUT_MS}ms`);
    this.name = "EngineTimeoutError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` with a hard timeout. Rejects with EngineTimeoutError if it doesn't
 * settle in time. The AbortSignal is passed to `fn` so fetch-based callers can
 * actually cancel the in-flight request.
 */
async function withTimeout<T>(
  engine: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new EngineTimeoutError(engine)),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `fn` with a 30s timeout and up to 3 attempts, backing off exponentially
 * (0.5s, 1s, 2s) with jitter. Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  engine: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await withTimeout(engine, fn);
    } catch (error) {
      lastError = error;
      const isLast = attempt === MAX_ATTEMPTS - 1;
      if (isLast) break;
      const backoff =
        BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(
        `[${engine}] attempt ${attempt + 1} failed, retrying in ${backoff}ms:`,
        error instanceof Error ? error.message : error,
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}
