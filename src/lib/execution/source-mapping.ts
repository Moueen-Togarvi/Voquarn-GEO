import { db } from "@/lib/db";
import { ScanStatus, Engine } from "@/lib/types";
import { completeText, SMART_MODEL } from "@/lib/ai";

export type SourceType =
  "reddit" | "review" | "listicle" | "youtube" | "docs" | "blog" | "other";

export interface MappedSource {
  url: string;
  title: string;
  type: SourceType;
  /** True if this source actually appeared in the brand's AI-answer citations. */
  influencesAI: boolean;
}

interface SerperOrganic {
  title?: string;
  link?: string;
}
interface SerperResponse {
  organic?: SerperOrganic[];
}

function classify(url: string): SourceType {
  const u = url.toLowerCase();
  if (u.includes("reddit.com")) return "reddit";
  if (
    u.includes("g2.com") ||
    u.includes("capterra.") ||
    u.includes("trustpilot.") ||
    u.includes("getapp.")
  )
    return "review";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("/docs") || u.includes("docs.")) return "docs";
  if (/best|top-|-vs-|alternatives/.test(u)) return "listicle";
  if (u.includes("/blog") || u.includes("blog.")) return "blog";
  return "other";
}

/** Query Serper.dev for a single query; returns organic results. */
async function serperSearch(
  query: string,
  apiKey: string,
): Promise<SerperOrganic[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as SerperResponse;
  return data.organic ?? [];
}

/**
 * Find the third-party pages AI engines are likely to cite for a brand's key
 * buyer-intent queries, and flag the ones that already show up in its AI-answer
 * citations. Skips brand-owned pages. Returns [] if SERPER_API_KEY is unset.
 */
export async function mapSources(brandId: string): Promise<MappedSource[]> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    include: { prompts: { take: 6 } },
  });
  if (!brand) throw new Error(`Brand ${brandId} not found`);

  const apiKey = process.env.SERPER_API_KEY;
  const brandHost = brand.domain
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./, "")
    .split("/")[0];

  // Cross-reference: which sources actually influence AI answers (Perplexity
  // returns real citations, so it's the strongest signal).
  const latestRun = await db.scanRun.findFirst({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "desc" },
  });
  const citedUrls = new Set<string>();
  if (latestRun) {
    const cited = await db.result.findMany({
      where: { scanRunId: latestRun.id, engine: Engine.PERPLEXITY },
      select: { citedSources: true },
    });
    for (const r of cited) for (const s of r.citedSources) citedUrls.add(s);
  }

  const byUrl = new Map<string, MappedSource>();

  // Seed with the actual AI citations first — these are known influencers.
  for (const url of citedUrls) {
    if (url.includes(brandHost)) continue;
    byUrl.set(url, {
      url,
      title: url,
      type: classify(url),
      influencesAI: true,
    });
  }

  // Then search Serper for the brand's buyer-intent queries.
  if (apiKey) {
    const queries = brand.prompts.map((p) => p.text).slice(0, 5);
    for (const query of queries) {
      const organic = await serperSearch(query, apiKey);
      for (const result of organic) {
        const url = result.link;
        if (!url || url.includes(brandHost)) continue;
        const existing = byUrl.get(url);
        if (existing) {
          if (result.title) existing.title = result.title;
        } else {
          byUrl.set(url, {
            url,
            title: result.title ?? url,
            type: classify(url),
            influencesAI: citedUrls.has(url),
          });
        }
      }
    }
  }

  // Rank: AI-influencing first, then reviews/reddit/listicles (high-leverage).
  const typeWeight: Record<SourceType, number> = {
    review: 0,
    reddit: 1,
    listicle: 2,
    youtube: 3,
    blog: 4,
    docs: 5,
    other: 6,
  };
  return [...byUrl.values()].sort(
    (a, b) =>
      Number(b.influencesAI) - Number(a.influencesAI) ||
      typeWeight[a.type] - typeWeight[b.type],
  );
}

export interface OutreachOpportunity {
  source: string;
  type: SourceType;
  why: string;
  action: string;
  emailDraft?: string;
}

const WHY_BY_TYPE: Record<SourceType, string> = {
  review:
    "AI answers frequently cite review sites; a profile here boosts trust.",
  reddit: "Reddit threads are heavily cited by AI engines for candid opinions.",
  listicle: "Roundup listicles are prime real estate for inclusion/outreach.",
  youtube: "Video reviews surface in AI answers and search.",
  blog: "Independent blogs shape the corpus AI models learn from.",
  docs: "Documentation coverage improves factual grounding.",
  other: "A relevant third-party page that could carry your mention.",
};

const ACTION_BY_TYPE: Record<SourceType, string> = {
  review: "Claim or create a profile and gather reviews.",
  reddit: "Answer the thread authentically (disclose affiliation).",
  listicle: "Pitch the author for inclusion with a factual entry.",
  youtube: "Reach out for a review or provide accurate product info.",
  blog: "Offer the writer a factual briefing or guest contribution.",
  docs: "Ensure accurate, linkable documentation exists.",
  other: "Evaluate for a mention or backlink opportunity.",
};

/**
 * Turn mapped sources into outreach opportunities, drafting an email for the
 * outreach-friendly types (listicle/blog/youtube) via Claude.
 */
export async function generateOutreachList(
  brandName: string,
  sources: MappedSource[],
): Promise<OutreachOpportunity[]> {
  const opportunities: OutreachOpportunity[] = [];

  for (const src of sources.slice(0, 12)) {
    const opp: OutreachOpportunity = {
      source: src.url,
      type: src.type,
      why: WHY_BY_TYPE[src.type],
      action: ACTION_BY_TYPE[src.type],
    };

    // Draft a short outreach email only where a human pitch makes sense.
    if (
      src.type === "listicle" ||
      src.type === "blog" ||
      src.type === "youtube"
    ) {
      opp.emailDraft = await draftOutreachEmail(brandName, src);
    }

    opportunities.push(opp);
  }

  return opportunities;
}

async function draftOutreachEmail(
  brandName: string,
  source: MappedSource,
): Promise<string | undefined> {
  try {
    return (
      await completeText({
        model: SMART_MODEL,
        maxTokens: 400,
        system:
          "You write short, respectful outreach emails to writers/creators. " +
          "No hype, no pressure. 4-6 sentences. Include a subject line.",
        prompt: [
          `Draft an outreach email from the ${brandName} team to the author of`,
          `this page: "${source.title}" (${source.url}).`,
          "Politely offer accurate product information for potential inclusion,",
          "and make it easy to say no. Return the subject line then the body.",
        ].join("\n"),
      })
    ).trim();
  } catch {
    return undefined;
  }
}
