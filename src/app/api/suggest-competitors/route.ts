import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { suggestCompetitors } from "@/lib/prompts/generator";

export const maxDuration = 30;

const bodySchema = z.object({
  name: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

/**
 * POST /api/suggest-competitors — Claude-suggested competitor names for the
 * onboarding wizard. Auth-gated but brand-agnostic (runs before a brand exists).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const competitors = await suggestCompetitors(parsed.data);
  return NextResponse.json({ competitors });
}
