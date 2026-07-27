import { db } from "@/lib/db";
import { ScanStatus, AlertType } from "@/lib/types";

/** Percentage-point drop in overall visibility that triggers an alert. */
const DROP_THRESHOLD = 10;

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

/**
 * Compare a brand's two most recent completed scans and create a
 * VISIBILITY_DROP alert if the overall score fell by more than the threshold.
 * Safe to call after any scan; a no-op when there's nothing to compare.
 */
export async function checkVisibilityDrop(brandId: string): Promise<void> {
  const runs = await db.scanRun.findMany({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: { visibilityScores: true },
  });
  if (runs.length < 2) return;

  const [latest, previous] = runs;
  const latestScore = avg(latest.visibilityScores.map((v) => v.score));
  const prevScore = avg(previous.visibilityScores.map((v) => v.score));
  const drop = prevScore - latestScore;

  if (drop >= DROP_THRESHOLD) {
    await db.alert.create({
      data: {
        brandId,
        type: AlertType.VISIBILITY_DROP,
        message: `Visibility dropped ${drop.toFixed(1)} points (from ${prevScore.toFixed(0)} to ${latestScore.toFixed(0)}) in the latest scan.`,
      },
    });
  }
}
