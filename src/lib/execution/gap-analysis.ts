import { db } from "@/lib/db";
import { ScanStatus, Severity, type Engine } from "@/lib/types";
import { detectBrandMention } from "@/lib/analysis/parser";
import { completeText, SMART_MODEL } from "@/lib/ai";

export interface Gap {
  promptText: string;
  category: string;
  /** Engines on which competitors win and the brand is absent. */
  engines: Engine[];
  competitorsWinning: string[];
  citedSources: string[];
  severity: Severity;
  recommendedAction: string;
}

/** High-intent categories weigh more heavily toward HIGH severity. */
const HIGH_INTENT = new Set(["comparison", "recommendation", "evaluation"]);

/**
 * Analyze the latest completed scan for a brand and return prioritized gaps:
 * prompts where the brand is NOT mentioned but a competitor IS. Persists the
 * gaps (replacing any prior set) so the Action Center can track them.
 */
export async function analyzeGaps(brandId: string): Promise<Gap[]> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    include: { competitors: true },
  });
  if (!brand) throw new Error(`Brand ${brandId} not found`);

  const latestRun = await db.scanRun.findFirst({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "desc" },
  });
  if (!latestRun) return [];

  const results = await db.result.findMany({
    where: { scanRunId: latestRun.id },
    include: { prompt: { select: { text: true, category: true } } },
  });

  const competitorNames = brand.competitors.map((c) => c.name);

  // Aggregate per prompt across engines.
  interface Agg {
    promptText: string;
    category: string;
    engines: Engine[];
    competitors: Set<string>;
    sources: Set<string>;
    brandMentionedAnywhere: boolean;
  }
  const byPrompt = new Map<string, Agg>();

  for (const r of results) {
    const key = r.prompt.text;
    let agg = byPrompt.get(key);
    if (!agg) {
      agg = {
        promptText: r.prompt.text,
        category: r.prompt.category,
        engines: [],
        competitors: new Set(),
        sources: new Set(),
        brandMentionedAnywhere: false,
      };
      byPrompt.set(key, agg);
    }
    if (r.brandMentioned) agg.brandMentionedAnywhere = true;

    const winning = competitorNames.filter(
      (name) => detectBrandMention(r.responseText, name).mentioned,
    );
    if (!r.brandMentioned && winning.length > 0) {
      agg.engines.push(r.engine);
      winning.forEach((w) => agg!.competitors.add(w));
      r.citedSources.forEach((s) => agg!.sources.add(s));
    }
  }

  // A gap = brand absent on ≥1 engine where a competitor wins, and never
  // mentioned anywhere for that prompt (a true blind spot).
  const rawGaps = [...byPrompt.values()].filter(
    (a) => !a.brandMentionedAnywhere && a.engines.length > 0,
  );

  const gaps: Gap[] = [];
  for (const a of rawGaps) {
    const severity = scoreSeverity(a.category, a.engines.length);
    const recommendedAction = await recommendAction({
      brandName: brand.name,
      industry: brand.industry,
      promptText: a.promptText,
      competitors: [...a.competitors],
      sources: [...a.sources],
    });
    gaps.push({
      promptText: a.promptText,
      category: a.category,
      engines: a.engines,
      competitorsWinning: [...a.competitors],
      citedSources: [...a.sources],
      severity,
      recommendedAction,
    });
  }

  // Rank: HIGH → MEDIUM → LOW, then by number of engines losing.
  const order: Record<Severity, number> = {
    [Severity.HIGH]: 0,
    [Severity.MEDIUM]: 1,
    [Severity.LOW]: 2,
  };
  gaps.sort(
    (x, y) =>
      order[x.severity] - order[y.severity] ||
      y.engines.length - x.engines.length,
  );

  // Persist: replace the brand's gap set with this analysis.
  await db.$transaction([
    db.gap.deleteMany({ where: { brandId } }),
    db.gap.createMany({
      data: gaps.map((g) => ({
        brandId,
        promptText: g.promptText,
        category: g.category,
        competitorsWinning: g.competitorsWinning,
        citedSources: g.citedSources,
        severity: g.severity,
        recommendedAction: g.recommendedAction,
      })),
    }),
  ]);

  return gaps;
}

function scoreSeverity(category: string, enginesLosing: number): Severity {
  const highIntent = HIGH_INTENT.has(category);
  if (highIntent && enginesLosing >= 2) return Severity.HIGH;
  if (highIntent || enginesLosing >= 2) return Severity.MEDIUM;
  return Severity.LOW;
}

/** Categorize a source URL into a coarse type for the action prompt. */
function sourceType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("reddit.com")) return "Reddit";
  if (
    u.includes("g2.com") ||
    u.includes("capterra.") ||
    u.includes("trustpilot.")
  )
    return "review site";
  if (u.includes("youtube.com")) return "YouTube";
  if (u.includes("/docs") || u.includes("docs.")) return "docs";
  return "blog/article";
}

async function recommendAction(input: {
  brandName: string;
  industry: string;
  promptText: string;
  competitors: string[];
  sources: string[];
}): Promise<string> {
  const sourceSummary =
    input.sources.length > 0
      ? [...new Set(input.sources.map(sourceType))].join(", ")
      : "no notable sources cited";

  try {
    const raw = await completeText({
      model: SMART_MODEL,
      maxTokens: 256,
      system:
        "You are a GEO (generative engine optimization) strategist. Given a " +
        "buyer-intent prompt where a brand is missing from AI answers, output " +
        "ONE specific, actionable recommendation (max 30 words). Be concrete: " +
        'name the asset to create or place (e.g. "Publish a Brand vs X ' +
        'comparison page", "Get listed on G2", "Answer this on the relevant ' +
        'Reddit thread"). Return plain text only.',
      prompt: [
        `Brand: ${input.brandName} (${input.industry})`,
        `Prompt: "${input.promptText}"`,
        `Competitors currently winning: ${input.competitors.join(", ")}`,
        `Winning answers cite: ${sourceSummary}`,
      ].join("\n"),
    });
    const action = raw.trim();
    if (action) return action;
  } catch {
    // fall through to template
  }

  // Deterministic fallback.
  return `Create content targeting "${input.promptText}" and seek placement on ${sourceSummary}.`;
}

export type { Severity };
