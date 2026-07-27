import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { IntegrationProvider } from "@/lib/types";

// Provider-specific credential shapes (validated per provider).
const wordpressSchema = z.object({
  provider: z.literal("WORDPRESS"),
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});
const webhookSchema = z.object({
  provider: z.literal("GENERIC_WEBHOOK"),
  url: z.string().url(),
  secret: z.string().optional(),
});
const bodySchema = z.discriminatedUnion("provider", [
  wordpressSchema,
  webhookSchema,
]);

/** GET /api/brands/[id]/integrations — list connected destinations (no secrets). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }
  const integrations = await db.integration.findMany({
    where: { brandId: id },
    select: { id: true, provider: true, siteUrl: true, createdAt: true },
  });
  return NextResponse.json({ integrations });
}

/** POST /api/brands/[id]/integrations — connect a publishing destination. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  const { provider, siteUrl, credentials } =
    input.provider === "WORDPRESS"
      ? {
          provider: IntegrationProvider.WORDPRESS,
          siteUrl: input.siteUrl,
          credentials: {
            siteUrl: input.siteUrl,
            username: input.username,
            appPassword: input.appPassword,
          },
        }
      : {
          provider: IntegrationProvider.GENERIC_WEBHOOK,
          siteUrl: input.url,
          credentials: { url: input.url, secret: input.secret },
        };

  const created = await db.integration.create({
    data: { brandId: id, provider, siteUrl, credentials },
    select: { id: true, provider: true, siteUrl: true },
  });
  return NextResponse.json({ integration: created }, { status: 201 });
}
