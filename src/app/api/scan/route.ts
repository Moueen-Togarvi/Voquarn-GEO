import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ScanStatus } from "@/lib/types";
import { requireBrandOwnership } from "@/lib/auth";
import { createPendingScanRun, runScan } from "@/lib/scan/runner";

// A scan fans out across many engine calls; give the function room to finish
// its background work. Adjust with the deploy plan's function limits.
export const maxDuration = 300;

const bodySchema = z.object({ brandId: z.string().min(1) });

/**
 * POST /api/scan — start a scan for a brand the caller owns. Creates a PENDING
 * ScanRun synchronously so we can return its stable id immediately, then runs
 * the scan in the background via after() and lets the client poll
 * /api/scan/[id] for progress.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }
  const { brandId } = parsed.data;

  const access = await requireBrandOwnership(brandId);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not authorized for this brand" },
      { status: access.status },
    );
  }

  const scanRunId = await createPendingScanRun(brandId);

  after(async () => {
    try {
      await runScan(brandId, scanRunId);
    } catch (error) {
      console.error("[api/scan] background scan failed:", error);
    }
  });

  return NextResponse.json({ scanRunId, status: ScanStatus.PENDING });
}
