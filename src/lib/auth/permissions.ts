import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Shared between src/lib/auth/server.ts and src/lib/auth/client.ts. Better
 * Auth's client-side role/permission types are inferred from whatever `ac`
 * and `roles` the client plugin is given directly — they do not cross the
 * network boundary from the server config automatically. Importing the same
 * objects on both sides is what makes "OWNER" a valid role at the type level
 * in client code (e.g. authClient.organization.inviteMember({ role })).
 *
 * Only the statements Better Auth's own organization-management endpoints
 * need (invite/remove a member, update or delete the workspace, manage
 * dynamic roles). App resources — Brand, Operation, etc. — are authorized by
 * our own rank-based assertRole() in src/lib/auth/context.ts, not by this
 * access-control layer; the two are deliberately separate.
 */
const statement = {
  organization: defaultStatements.organization,
  member: defaultStatements.member,
  invitation: defaultStatements.invitation,
  ac: defaultStatements.ac,
} as const;

export const ac = createAccessControl(statement);

// Mirrors src/lib/auth/context.ts's WorkspaceRole rank (VIEWER < EDITOR <
// ADMIN < OWNER). Only OWNER can delete the workspace or manage roles;
// EDITOR/VIEWER cannot touch organization management at all.
export const roles = {
  OWNER: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    ac: ["create", "read", "update", "delete"],
  }),
  ADMIN: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    ac: [],
  }),
  EDITOR: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    ac: [],
  }),
  VIEWER: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    ac: [],
  }),
};
