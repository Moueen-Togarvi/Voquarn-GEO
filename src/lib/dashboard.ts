import { db } from "@/lib/db";
import { Engine, Sentiment, ScanStatus } from "@/lib/types";
import { ENGINE_ORDER } from "@/lib/scan/serialize";

export interface EngineCardData {
  engine: Engine;
  score: number;
  shareOfVoice: number;
  citationRate: number;
}

export interface PromptRow {
  promptText: string;
  category: string;
  /** engine -> mentioned (undefined = not queried on this engine). */
  mentions: Partial<Record<Engine, boolean>>;
  /** engine -> full result detail for the expandable row. */
  details: {
    engine: Engine;
    responseText: string;
    citedSources: string[];
    sentiment: Sentiment | null;
  }[];
}

export interface TrendPoint {
  /** ISO date label for the x-axis. */
  label: string;
  score: number;
}

export interface BrandDashboard {
  brand: { id: string; name: string; domain: string; industry: string };
  hasScan: boolean;
  latestScanStatus: ScanStatus | null;
  overallScore: number;
  engineCards: EngineCardData[];
  /** Share of voice: brand + each competitor, for the bar chart. */
  shareOfVoice: { name: string; value: number }[];
  trend: TrendPoint[];
  prompts: PromptRow[];
  sentiment: { positive: number; neutral: number; negative: number };
}

/**
 * Build everything the brand dashboard renders from the latest completed scan.
 * Returns null if the brand doesn't exist or isn't owned by `userId`.
 */
export async function getBrandDashboard(
  brandId: string,
  userId: string,
): Promise<BrandDashboard | null> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    include: { competitors: true },
  });
  if (!brand || brand.userId !== userId) return null;

  // Trend: overall score per past scan run (oldest → newest).
  const runs = await db.scanRun.findMany({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "asc" },
    include: { visibilityScores: true },
  });

  const trend: TrendPoint[] = runs.map((run) => {
    const scores = run.visibilityScores;
    const avg =
      scores.length > 0
        ? scores.reduce((s, v) => s + v.score, 0) / scores.length
        : 0;
    return {
      label: run.startedAt.toISOString().slice(0, 10),
      score: Math.round(avg * 10) / 10,
    };
  });

  const latestRun = runs[runs.length - 1] ?? null;

  const base: BrandDashboard = {
    brand: {
      id: brand.id,
      name: brand.name,
      domain: brand.domain,
      industry: brand.industry,
    },
    hasScan: latestRun !== null,
    latestScanStatus: latestRun ? ScanStatus.DONE : null,
    overallScore: 0,
    engineCards: [],
    shareOfVoice: [],
    trend,
    prompts: [],
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };

  if (!latestRun) return base;

  // Engine cards from the latest run's visibility scores, in fixed order.
  const scoreByEngine = new Map(
    latestRun.visibilityScores.map((v) => [v.engine, v]),
  );
  base.engineCards = ENGINE_ORDER.filter((e) => scoreByEngine.has(e)).map(
    (engine) => {
      const v = scoreByEngine.get(engine)!;
      return {
        engine,
        score: v.score,
        shareOfVoice: v.shareOfVoice,
        citationRate: v.citationRate,
      };
    },
  );

  base.overallScore =
    base.engineCards.length > 0
      ? Math.round(
          (base.engineCards.reduce((s, c) => s + c.score, 0) /
            base.engineCards.length) *
            10,
        ) / 10
      : 0;

  // Results for the latest run drive the prompts table, SoV, and sentiment.
  const results = await db.result.findMany({
    where: { scanRunId: latestRun.id },
    include: { prompt: { select: { text: true, category: true } } },
  });

  // Share of voice: count brand mentions vs each competitor across results.
  const competitorNames = brand.competitors.map((c) => c.name);
  let brandMentions = 0;
  const competitorCounts = new Map<string, number>(
    competitorNames.map((n) => [n, 0]),
  );
  const sentiment = { positive: 0, neutral: 0, negative: 0 };

  // Group results by prompt for the table.
  const promptMap = new Map<string, PromptRow>();

  for (const r of results) {
    if (r.brandMentioned) brandMentions++;
    if (r.sentiment === Sentiment.POSITIVE) sentiment.positive++;
    else if (r.sentiment === Sentiment.NEGATIVE) sentiment.negative++;
    else if (r.sentiment === Sentiment.NEUTRAL) sentiment.neutral++;

    // Cheap competitor tally: substring match on the response text.
    const lower = r.responseText.toLowerCase();
    for (const name of competitorNames) {
      if (lower.includes(name.toLowerCase())) {
        competitorCounts.set(name, (competitorCounts.get(name) ?? 0) + 1);
      }
    }

    const key = r.prompt.text;
    let row = promptMap.get(key);
    if (!row) {
      row = {
        promptText: r.prompt.text,
        category: r.prompt.category,
        mentions: {},
        details: [],
      };
      promptMap.set(key, row);
    }
    row.mentions[r.engine] = r.brandMentioned;
    row.details.push({
      engine: r.engine,
      responseText: r.responseText,
      citedSources: r.citedSources,
      sentiment: r.sentiment,
    });
  }

  base.shareOfVoice = [
    { name: brand.name, value: brandMentions },
    ...competitorNames.map((n) => ({
      name: n,
      value: competitorCounts.get(n) ?? 0,
    })),
  ];
  base.sentiment = sentiment;
  base.prompts = [...promptMap.values()];

  return base;
}
