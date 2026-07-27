import { db } from "@/lib/db";
import { FameTaskKind, FameTaskStatus, Severity } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import { analyzeGaps } from "@/lib/execution/gap-analysis";

export interface PlannedTask {
  kind: FameTaskKind;
  title: string;
  detail: string;
  payload?: Prisma.InputJsonValue;
}

/**
 * Compose a brand's "Fame Plan" — the ordered, actionable checklist that
 * actually improves AI visibility. Built from gap analysis (what content to
 * create) plus the standing technical signals every brand should send.
 * Replaces the brand's existing TODO tasks; DONE tasks are preserved.
 */
export async function buildFamePlan(brandId: string): Promise<void> {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`Brand ${brandId} not found`);

  const gaps = await analyzeGaps(brandId);

  const planned: PlannedTask[] = [];

  // 1. Content tasks — one per high/medium gap, ordered by severity.
  const contentGaps = gaps
    .filter((g) => g.severity !== Severity.LOW)
    .slice(0, 8);
  for (const gap of contentGaps) {
    const competitor = gap.competitorsWinning[0];
    planned.push({
      kind: FameTaskKind.PUBLISH_CONTENT,
      title: competitor
        ? `Publish "${brand.name} vs ${competitor}" content`
        : `Publish an answer for "${gap.promptText}"`,
      detail: gap.recommendedAction,
      payload: {
        promptText: gap.promptText,
        competitor: competitor ?? null,
        // The content type the /content route should generate for this task.
        contentType: competitor ? "comparison" : "snippet",
      },
    });
  }

  // 2. Off-site mention tasks (human-driven) from the winning sources.
  const mentionTargets = new Set<string>();
  for (const gap of gaps) {
    for (const src of gap.citedSources) mentionTargets.add(src);
  }
  for (const src of [...mentionTargets].slice(0, 3)) {
    planned.push({
      kind: FameTaskKind.GET_MENTION,
      title: `Earn a mention on ${hostOf(src)}`,
      detail: `This source is cited in AI answers where competitors win. Aim for an authentic mention or listing.`,
      payload: { source: src },
    });
  }

  // 3. Standing technical signals every brand should send.
  planned.push(
    {
      kind: FameTaskKind.ADD_SCHEMA,
      title: "Add JSON-LD schema to your site",
      detail:
        "Paste the generated Organization + Product schema into your site's <head> so AI engines parse accurate facts.",
    },
    {
      kind: FameTaskKind.UPDATE_LLMS_TXT,
      title: "Publish llms.txt",
      detail:
        "Host the generated llms.txt at your domain root so AI crawlers get a curated map of your site.",
    },
    {
      kind: FameTaskKind.SUBMIT_INDEXNOW,
      title: "Submit your pages to IndexNow",
      detail:
        "Ping IndexNow so Bing (and ChatGPT Search) re-crawl your updated pages quickly.",
    },
  );

  // Replace the brand's pending (TODO/IN_PROGRESS) tasks; keep DONE history.
  await db.$transaction([
    db.fameTask.deleteMany({
      where: { brandId, status: { not: FameTaskStatus.DONE } },
    }),
    db.fameTask.createMany({
      data: planned.map((t) => ({
        brandId,
        kind: t.kind,
        title: t.title,
        detail: t.detail,
        payload: t.payload ?? undefined,
      })),
    }),
  ]);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
