import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { PromptSource } from "@/lib/types";

const bodySchema = z.object({
  text: z.string().trim().min(3),
  category: z.string().trim().min(1).default("discovery"),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
});

/** GET /api/brands/[id]/prompts — list the brand's tracked prompts. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }
  const prompts = await db.prompt.findMany({
    where: { brandId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ prompts });
}

/** POST /api/brands/[id]/prompts — add a prompt manually. */
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const prompt = await db.prompt.create({
    data: {
      brandId: id,
      text: parsed.data.text,
      category: parsed.data.category,
      tags: parsed.data.tags,
      source: PromptSource.USER,
    },
  });
  return NextResponse.json({ prompt }, { status: 201 });
}
