import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";

import { db } from "@/lib/db";
import { ac, roles } from "@/lib/auth/permissions";
import { childLogger } from "@/lib/observability/logger";

const log = childLogger({ module: "auth" });

const authBaseURL = (
  process.env.BETTER_AUTH_URL?.trim() ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Real delivery is a Phase 7 concern (docs/adr — transactional email
    // provider). Logging keeps the reset flow functional in dev/beta without
    // silently dropping the token.
    sendResetPassword: async ({ user, url }) => {
      log.info({ userId: user.id, url }, "password reset requested");
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "OWNER",
      schema: {
        organization: { modelName: "workspace" },
        member: { fields: { organizationId: "workspaceId" } },
        invitation: { fields: { organizationId: "workspaceId" } },
      },
      // Better Auth does not generate invitation URLs — see its own
      // sendInvitationEmail doc comment. This one always points at our own
      // accept-invite route, keyed by the invitation id.
      sendInvitationEmail: async (data) => {
        const url = `${authBaseURL}/accept-invite/${data.id}`;
        log.info(
          { email: data.email, workspaceId: data.organization.id, url },
          "workspace invitation created",
        );
      },
    }),
    // Must be the last plugin — it hooks the outgoing response to set
    // cookies via next/headers, which only works from a route handler or
    // server action call chain.
    nextCookies(),
  ],
});
