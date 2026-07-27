import { db } from "@/lib/db";
import { Tier, SubscriptionStatus } from "@/lib/types";
import { tierOf, type TierLimits } from "@/lib/billing/tiers";

// ─────────────────────────────────────────────────────────────
// ⏸  BILLING PAUSED (per request).
// The tier structure is kept, but ALL limit checks currently return { ok: true }
// so nothing is gated while payments are not integrated. When Paddle billing is
// added, flip ENFORCE_LIMITS to true (and uncomment the real checks below).
// ─────────────────────────────────────────────────────────────
const ENFORCE_LIMITS = false;

/** Resolve a user's effective tier (STARTER unless an ACTIVE/TRIALING sub). */
export async function getUserTier(userId: string): Promise<TierLimits> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  const active =
    sub &&
    (sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.TRIALING);
  return tierOf(active ? sub.tier : Tier.STARTER);
}

export type LimitCheck = { ok: true } | { ok: false; reason: string };

/** Can this user create another brand? */
export async function canCreateBrand(userId: string): Promise<LimitCheck> {
  if (!ENFORCE_LIMITS) return { ok: true };
  const limits = await getUserTier(userId);
  const count = await db.brand.count({ where: { userId } });
  if (count >= limits.maxBrands) {
    return {
      ok: false,
      reason: `Your ${limits.label} plan allows ${limits.maxBrands} brand${limits.maxBrands === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }
  return { ok: true };
}

/** Can this user generate GEO content / publish (Pro+ feature)? */
export async function canGenerateContent(userId: string): Promise<LimitCheck> {
  if (!ENFORCE_LIMITS) return { ok: true };
  const limits = await getUserTier(userId);
  if (!limits.contentGeneration) {
    return {
      ok: false,
      reason:
        "Content generation and the Fame Plan are available on Pro and Agency. Upgrade to unlock them.",
    };
  }
  return { ok: true };
}

/** Is a given scan frequency allowed on the user's plan? */
export async function canUseScanFrequency(
  userId: string,
  frequency: "OFF" | "WEEKLY" | "DAILY",
): Promise<LimitCheck> {
  if (!ENFORCE_LIMITS) return { ok: true };
  const limits = await getUserTier(userId);
  if (!limits.scanFrequencies.includes(frequency)) {
    return {
      ok: false,
      reason: `Daily scans require Pro or Agency. Upgrade to schedule them.`,
    };
  }
  return { ok: true };
}
