import { db } from "@/lib/db";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

type RateLimitOptions = {
  /** Identifies what is being limited, e.g. "brand-discovery:{workspaceId}". */
  key: string;
  limit: number;
  windowMs: number;
};

/**
 * A fixed-window token bucket backed by RateLimitBucket. One row per
 * (key, window) pair; the increment is a single atomic UPDATE, so concurrent
 * requests cannot race past the limit.
 *
 * Rows are never pruned by this function — a future phase should add a
 * cron sweeping windowStart older than a few windows back once real traffic
 * makes that necessary.
 */
export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = new Date(windowStartMs + windowMs);
  const bucketKey = `${key}:${windowStartMs}`;

  const bucket = await db.rateLimitBucket.upsert({
    where: { key: bucketKey },
    update: { count: { increment: 1 } },
    create: { key: bucketKey, windowStart, count: 1 },
  });

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt,
  };
}
