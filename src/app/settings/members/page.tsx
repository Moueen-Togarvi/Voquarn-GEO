import { MembersManager } from "@/components/members-manager";
import { PageHeader } from "@/components/page-header";
import { assertRole, requireWorkspaceContext } from "@/lib/auth/context";
import { listMembers, listPendingInvitations } from "@/lib/members/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members" };

export default async function MembersPage() {
  const ctx = await requireWorkspaceContext();
  assertRole(ctx, "ADMIN");

  const [members, invitations] = await Promise.all([
    listMembers(ctx),
    listPendingInvitations(ctx),
  ]);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Workspace"
        title="Members"
        description="Manage who has access to this workspace and what they can do."
      />
      <MembersManager members={members} invitations={invitations} />
    </div>
  );
}
