import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

/**
 * Every flag the roadmap has named so far, gating a provider, publisher, or
 * autonomous action before it is trusted by default. Add to this object as
 * each phase introduces one; do not invent ad hoc string keys at call sites.
 */
export const FEATURE_FLAGS = {
  /** Phase 7: publish directly instead of always leaving a draft. Off until a trust period has passed per project. */
  LIVE_AUTOPUBLISH: "live-autopublish",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Every flag defaults off in code; a row only ever needs to exist to turn one on for a workspace. */
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.LIVE_AUTOPUBLISH]: false,
};

export async function isFeatureEnabled(
  ctx: WorkspaceContext,
  key: FeatureFlagKey,
): Promise<boolean> {
  const flag = await scopedDb(ctx).featureFlag.findUnique({
    where: { workspaceId_key: { workspaceId: ctx.workspaceId, key } },
  });

  return flag?.enabled ?? DEFAULTS[key];
}
