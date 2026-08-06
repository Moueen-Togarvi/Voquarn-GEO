"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { WorkspaceRole } from "@/lib/auth/context";
import type { InvitationDto, MemberDto } from "@/lib/members/service";

const ROLE_OPTIONS: WorkspaceRole[] = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];

export function MembersManager({
  members,
  invitations,
}: {
  members: MemberDto[];
  invitations: InvitationDto[];
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("invite");

    const result = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: inviteRole,
    });

    setPending(null);
    if (result.error) {
      setError(result.error.message ?? "Could not send the invitation.");
      return;
    }

    setInviteEmail("");
    router.refresh();
  }

  async function handleRoleChange(memberId: string, role: WorkspaceRole) {
    setError(null);
    setPending(memberId);

    const result = await authClient.organization.updateMemberRole({
      memberId,
      role,
    });

    setPending(null);
    if (result.error) {
      setError(result.error.message ?? "Could not update the role.");
      return;
    }
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setError(null);
    setPending(memberId);

    const result = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
    });

    setPending(null);
    if (result.error) {
      setError(result.error.message ?? "Could not remove this member.");
      return;
    }
    router.refresh();
  }

  async function handleCancelInvite(invitationId: string) {
    setError(null);
    setPending(invitationId);

    const result = await authClient.organization.cancelInvitation({
      invitationId,
    });

    setPending(null);
    if (result.error) {
      setError(result.error.message ?? "Could not cancel the invitation.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="content-card">
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}

      <form className="form-grid two-columns" onSubmit={handleInvite}>
        <label className="field">
          <span>Invite by email</span>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            required
            disabled={pending === "invite"}
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select
            value={inviteRole}
            onChange={(event) =>
              setInviteRole(event.target.value as WorkspaceRole)
            }
            disabled={pending === "invite"}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={pending === "invite"}
          >
            {pending === "invite" ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>

      <h2>Members</h2>
      <ul className="setup-list">
        {members.map((member) => (
          <li className="setup-item" key={member.id}>
            <div>
              <strong>{member.user.name}</strong>
              <p>{member.user.email}</p>
            </div>
            <select
              value={member.role}
              onChange={(event) =>
                handleRoleChange(member.id, event.target.value as WorkspaceRole)
              }
              disabled={pending === member.id}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              className="button button-danger compact-button"
              type="button"
              onClick={() => handleRemove(member.id)}
              disabled={pending === member.id}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {invitations.length > 0 ? (
        <>
          <h2>Pending invitations</h2>
          <ul className="setup-list">
            {invitations.map((invitation) => (
              <li className="setup-item" key={invitation.id}>
                <div>
                  <strong>{invitation.email}</strong>
                  <p>{invitation.role}</p>
                </div>
                <button
                  className="button button-ghost compact-button"
                  type="button"
                  onClick={() => handleCancelInvite(invitation.id)}
                  disabled={pending === invitation.id}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
