import { db } from "@/lib/db";
import { ScanStatus, type Engine } from "@/lib/types";
import { engines } from "@/lib/engines";
import {
  detectBrandMention,
  detectCompetitorMentions,
  extractSentiment,
  domainCited,
} from "@/lib/analysis/parser";
import {
  calculateVisibility,
  type ScoreableResult,
} from "@/lib/analysis/scoring";
import { mapWithConcurrency } from "@/lib/scan/concurrency";

const CONCURRENCY = 5;

export interface ScanSummary {
  scanRunId: string;
  status: ScanStatus;
  promptCount: number;
  engineCount: number;
  resultCount: number;
}

/**
 * Create a ScanRun row in PENDING state. The API route calls this synchronously
 * so it can return a stable id to poll, then hands that id to runScan().
 */
export async function createPendingScanRun(brandId: string): Promise<string> {
  const run = await db.scanRun.create({
    data: { brandId, status: ScanStatus.PENDING },
  });
  return run.id;
}

/**
 * Run a full scan for a brand: query every configured engine with every
 * prompt, parse each response into a Result, then aggregate VisibilityScores.
 * Designed to run in the background — updates the ScanRun status as it goes.
 *
 * Pass an existing `scanRunId` (from createPendingScanRun) so the client can
 * poll a stable id; otherwise a new run is created.
 */
export async function runScan(
  brandId: string,
  scanRunId?: string,
): Promise<ScanSummary> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    include: { competitors: true, prompts: true },
  });
  if (!brand) throw new Error(`Brand ${brandId} not found`);

  const scanRun = scanRunId
    ? await db.scanRun.update({
        where: { id: scanRunId },
        data: { status: ScanStatus.RUNNING, startedAt: new Date() },
      })
    : await db.scanRun.create({
        data: { brandId, status: ScanStatus.RUNNING },
      });
  console.log(
    `[scan ${scanRun.id}] started for "${brand.name}" — ${brand.prompts.length} prompts × ${engines.length} engines`,
  );

  const competitorNames = brand.competitors.map((c) => c.name);

  try {
    if (engines.length === 0) {
      throw new Error("No AI engines are configured (missing API keys)");
    }
    if (brand.prompts.length === 0) {
      throw new Error("Brand has no prompts to scan");
    }

    // One unit of work = (prompt × engine). Flatten so the concurrency limit
    // applies across all engine calls, respecting shared rate limits.
    const jobs = brand.prompts.flatMap((prompt) =>
      engines.map((engine) => ({ prompt, engine })),
    );

    const scoreable: ScoreableResult[] = [];

    const settled = await mapWithConcurrency(
      jobs,
      CONCURRENCY,
      async ({ prompt, engine }) => {
        const response = await engine.runPrompt(prompt.text);

        const { mentioned, position } = detectBrandMention(
          response.text,
          brand.name,
        );
        const competitorMentions = detectCompetitorMentions(
          response.text,
          competitorNames,
        );
        const cited = domainCited(response.sources, brand.domain);
        const sentiment = mentioned
          ? await extractSentiment(response.text, brand.name)
          : null;

        await db.result.create({
          data: {
            promptId: prompt.id,
            scanRunId: scanRun.id,
            engine: engine.name,
            responseText: response.text,
            brandMentioned: mentioned,
            position,
            sentiment,
            citedSources: response.sources,
          },
        });

        scoreable.push({
          engine: engine.name,
          brandMentioned: mentioned,
          competitorMentionCount: competitorMentions.length,
          domainCited: cited,
        });
      },
    );

    const failed = settled.filter((s) => s.status === "rejected");
    if (failed.length > 0) {
      console.warn(
        `[scan ${scanRun.id}] ${failed.length}/${jobs.length} engine calls failed (continuing):`,
        (failed[0] as PromiseRejectedResult).reason,
      );
    }

    // Aggregate per-engine visibility and persist one score per engine.
    const visibilities = calculateVisibility(scoreable);
    await db.$transaction(
      visibilities.map((v) =>
        db.visibilityScore.upsert({
          where: {
            scanRunId_engine: { scanRunId: scanRun.id, engine: v.engine },
          },
          create: {
            brandId,
            scanRunId: scanRun.id,
            engine: v.engine,
            score: v.score,
            shareOfVoice: v.shareOfVoice,
            citationRate: v.citationRate,
          },
          update: {
            score: v.score,
            shareOfVoice: v.shareOfVoice,
            citationRate: v.citationRate,
          },
        }),
      ),
    );

    await db.scanRun.update({
      where: { id: scanRun.id },
      data: { status: ScanStatus.DONE, completedAt: new Date() },
    });
    console.log(
      `[scan ${scanRun.id}] done — ${scoreable.length} results, ${visibilities.length} engine scores`,
    );

    return {
      scanRunId: scanRun.id,
      status: ScanStatus.DONE,
      promptCount: brand.prompts.length,
      engineCount: engines.length,
      resultCount: scoreable.length,
    };
  } catch (error) {
    console.error(`[scan ${scanRun.id}] FAILED:`, error);
    await db.scanRun.update({
      where: { id: scanRun.id },
      data: { status: ScanStatus.FAILED, completedAt: new Date() },
    });
    return {
      scanRunId: scanRun.id,
      status: ScanStatus.FAILED,
      promptCount: brand.prompts.length,
      engineCount: engines.length,
      resultCount: 0,
    };
  }
}

// Re-export the enum type for the API layer.
export type { Engine };
