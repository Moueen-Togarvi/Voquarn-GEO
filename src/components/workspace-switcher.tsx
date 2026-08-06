"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient, useSession } from "@/lib/auth/client";

/**
 * Renders nothing until the user belongs to more than one workspace — most
 * accounts in the beta have exactly one, created automatically at sign-up.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: organizations } = authClient.useListOrganizations();
  const [switching, setSwitching] = useState(false);

  const activeId = session?.session.activeOrganizationId ?? "";

  async function handleSwitch(organizationId: string) {
    if (!organizationId || organizationId === activeId) return;
    setSwitching(true);
    await authClient.organization.setActive({ organizationId });
    setSwitching(false);
    router.push("/");
    router.refresh();
  }

  if (!organizations || organizations.length <= 1) {
    return null;
  }

  return (
    <select
      className="workspace-switcher"
      value={activeId}
      onChange={(event) => handleSwitch(event.target.value)}
      disabled={switching}
      aria-label="Switch workspace"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
