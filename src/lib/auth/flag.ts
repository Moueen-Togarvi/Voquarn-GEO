/**
 * Auth (Phase 1b) is fully built — Better Auth, sessions, organizations,
 * roles, invitations — but not yet enforced. Until this is flipped on, every
 * request falls back to the single default workspace that existed before
 * Phase 1b, so the product stays usable without signing in.
 *
 * Turn it on by setting AUTH_ENABLED=true. The plan is to do that once
 * billing (Phase 8) is integrated — there is no point making people create
 * accounts before there is a plan to put them on.
 *
 * Checked in exactly two places: requireWorkspaceContext() in
 * src/lib/auth/context.ts (server-side gate) and proxy.ts (redirect gate).
 * Everything else — the auth routes, the sign-in/sign-up pages, the
 * Better Auth tables — stays fully wired and unaffected by this flag.
 */
export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED === "true";
}
