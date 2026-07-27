import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ScanFrequency } from "@/lib/types";
import { requireBrandOwnership } from "@/lib/auth";
import { brandInputSchema } from "@/lib/validation/brand";

// Edit accepts any subset of the brand fields, plus scanFrequency. When
// `competitors` is present it fully replaces the brand's competitor set.
const patchSchema = brandInputSchema.partial().extend({
  scanFrequency: z.enum(["OFF", "WEEKLY", "DAILY"]).optional(),
});

/** PATCH /api/brands/[id] — edit a brand + manage competitors + scan frequency. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not authorized for this brand" },
      { status: access.status },
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  await db.brand.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.description !== undefined
        ? { description: input.description || null }
        : {}),
      ...(input.scanFrequency !== undefined
        ? { scanFrequency: input.scanFrequency as ScanFrequency }
        : {}),
      // Replace the competitor set wholesale when provided.
      ...(input.competitors !== undefined
        ? {
            competitors: {
              deleteMany: {},
              create: input.competitors.map((name) => ({ name })),
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/brands/[id] — remove a brand and all its data (cascade). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not authorized for this brand" },
      { status: access.status },
    );
  }

  await db.brand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
