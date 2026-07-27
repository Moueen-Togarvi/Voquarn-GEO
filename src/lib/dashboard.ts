import { db } from "@/lib/db";
import { Engine, Sentiment, ScanStatus, type ScanFrequency } from "@/lib/types";
import { ENGINE_ORDER } from "@/lib/scan/serialize";

export interface EngineCardData {
  engine: Engine;
  score: number;
  shareOfVoice: number;
  citationRate: number;
  /** Average ordinal rank across prompts where the brand was named, or null. */
  avgRank: number | null;
}

export interface PromptRow {
  promptText: string;
  category: string;
  volume: number | null;
  tags: string[];
  /** engine -> mentioned (undefined = not queried on this engine). */
  mentions: Partial<Record<Engine, boolean>>;
  /** Best (lowest) rank the brand achieved for this prompt across engines. */
  bestRank: number | null;
  /** engine -> full result detail for the expandable row. */
  details: {
    engine: Engine;
    responseText: string;
    citedSources: string[];
    sentiment: Sentiment | null;
    rank: number | null;
  }[];
}

export interface TrendPoint {
  /** ISO date label for the x-axis. */
  label: string;
  score: number;
}

export interface BrandDashboard {
  brand: {
    id: string;
    name: string;
    domain: string;
    industry: string;
    scanFrequency: ScanFrequency;
  };
  hasScan: boolean;
  latestScanStatus: ScanStatus | null;
  overallScore: number;
  /** Change in overall score vs the previous scan (null if only one scan). */
  trendDelta: number | null;
  engineCards: EngineCardData[];
  /** Share of voice: brand + each competitor, for the bar chart. */
  shareOfVoice: { name: string; value: number }[];
  trend: TrendPoint[];
  prompts: PromptRow[];
  sentiment: { positive: number; neutral: number; negative: number };
  competitors: string[];
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

  // Delta vs the previous scan's overall score.
  const trendDelta =
    trend.length >= 2
      ? Math.round(
          (trend[trend.length - 1].score - trend[trend.length - 2].score) * 10,
        ) / 10
      : null;

  const competitorNames = brand.competitors.map((c) => c.name);

  const base: BrandDashboard = {
    brand: {
      id: brand.id,
      name: brand.name,
      domain: brand.domain,
      industry: brand.industry,
      scanFrequency: brand.scanFrequency,
    },
    hasScan: latestRun !== null,
    latestScanStatus: latestRun ? ScanStatus.DONE : null,
    overallScore: 0,
    trendDelta,
    engineCards: [],
    shareOfVoice: [],
    trend,
    prompts: [],
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    competitors: competitorNames,
  };

  if (!latestRun) return base;

  // Results for the latest run drive the prompts table, SoV, sentiment, and
  // the per-engine average rank.
  const results = await db.result.findMany({
    where: { scanRunId: latestRun.id },
    include: {
      prompt: {
        select: { text: true, category: true, volume: true, tags: true },
      },
    },
  });

  // Per-engine average rank (across results where the brand was named).
  const rankByEngine = new Map<Engine, number[]>();
  for (const r of results) {
    if (typeof r.rank === "number") {
      const arr = rankByEngine.get(r.engine) ?? [];
      arr.push(r.rank);
      rankByEngine.set(r.engine, arr);
    }
  }
  const avgRankFor = (engine: Engine): number | null => {
    const arr = rankByEngine.get(engine);
    if (!arr || arr.length === 0) return null;
    return Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10;
  };

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
        avgRank: avgRankFor(engine),
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

  // Share of voice: count brand mentions vs each competitor across results.
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
        volume: r.prompt.volume,
        tags: r.prompt.tags,
        mentions: {},
        bestRank: null,
        details: [],
      };
      promptMap.set(key, row);
    }
    row.mentions[r.engine] = r.brandMentioned;
    if (typeof r.rank === "number") {
      row.bestRank =
        row.bestRank === null ? r.rank : Math.min(row.bestRank, r.rank);
    }
    row.details.push({
      engine: r.engine,
      responseText: r.responseText,
      citedSources: r.citedSources,
      sentiment: r.sentiment,
      rank: r.rank,
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

export interface ScanComparison {
  hasComparison: boolean;
  before: { date: string; score: number; mentions: number } | null;
  after: { date: string; score: number; mentions: number } | null;
  scoreDelta: number;
  mentionsDelta: number;
}

/**
 * Compare a brand's two most recent completed scans to prove Fame-plan impact
 * (before → after visibility & mention change).
 */
export async function compareScans(
  brandId: string,
  userId: string,
): Promise<ScanComparison | null> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    select: { userId: true },
  });
  if (!brand || brand.userId !== userId) return null;

  const runs = await db.scanRun.findMany({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: {
      visibilityScores: true,
      _count: { select: { results: { where: { brandMentioned: true } } } },
    },
  });

  const summarize = (run: (typeof runs)[number]) => {
    const scores = run.visibilityScores;
    const score =
      scores.length > 0
        ? Math.round(
            (scores.reduce((s, v) => s + v.score, 0) / scores.length) * 10,
          ) / 10
        : 0;
    return {
      date: run.startedAt.toISOString().slice(0, 10),
      score,
      mentions: run._count.results,
    };
  };

  if (runs.length < 2) {
    return {
      hasComparison: false,
      before: null,
      after: runs[0] ? summarize(runs[0]) : null,
      scoreDelta: 0,
      mentionsDelta: 0,
    };
  }

  const after = summarize(runs[0]);
  const before = summarize(runs[1]);
  return {
    hasComparison: true,
    before,
    after,
    scoreDelta: Math.round((after.score - before.score) * 10) / 10,
    mentionsDelta: after.mentions - before.mentions,
  };
}
