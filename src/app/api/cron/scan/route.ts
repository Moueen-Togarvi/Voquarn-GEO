import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ScanFrequency } from "@/lib/types";
import { runScan } from "@/lib/scan/runner";
import { checkVisibilityDrop } from "@/lib/alerts";

export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * GET /api/cron/scan — Vercel Cron target. Runs scans for brands whose
 * scanFrequency is due (DAILY / WEEKLY), then checks each for a visibility drop.
 * Guarded by CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();
  const brands = await db.brand.findMany({
    where: {
      scanFrequency: { in: [ScanFrequency.DAILY, ScanFrequency.WEEKLY] },
    },
    select: {
      id: true,
      name: true,
      scanFrequency: true,
      lastScheduledAt: true,
    },
  });

  const due = brands.filter((b) => {
    const interval = b.scanFrequency === ScanFrequency.DAILY ? DAY_MS : WEEK_MS;
    if (!b.lastScheduledAt) return true;
    return now - b.lastScheduledAt.getTime() >= interval;
  });

  const results: { brandId: string; status: string }[] = [];
  for (const brand of due) {
    try {
      const summary = await runScan(brand.id);
      await checkVisibilityDrop(brand.id);
      await db.brand.update({
        where: { id: brand.id },
        data: { lastScheduledAt: new Date() },
      });
      results.push({ brandId: brand.id, status: summary.status });
    } catch (error) {
      console.error(`[cron/scan] ${brand.name} failed:`, error);
      results.push({ brandId: brand.id, status: "ERROR" });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
