import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type MemberDto = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
};

export type InvitationDto = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};

export async function listMembers(ctx: WorkspaceContext): Promise<MemberDto[]> {
  const members = await scopedDb(ctx).member.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((member) => ({
    id: member.id,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    user: member.user,
  }));
}

export async function listPendingInvitations(
  ctx: WorkspaceContext,
): Promise<InvitationDto[]> {
  const invitations = await scopedDb(ctx).invitation.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
  }));
}
