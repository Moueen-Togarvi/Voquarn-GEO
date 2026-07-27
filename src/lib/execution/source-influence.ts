import { db } from "@/lib/db";
import { ScanStatus } from "@/lib/types";
import type { SourceType } from "@/lib/execution/source-mapping";

export interface InfluentialSource {
  domain: string;
  type: SourceType;
  /** How many of the latest scan's answers referenced this domain. */
  mentions: number;
  /** A sample URL for the domain, if one was found in the answer text. */
  sampleUrl?: string;
}

function classifyDomain(domain: string): SourceType {
  const d = domain.toLowerCase();
  if (d.includes("reddit.com")) return "reddit";
  if (
    d.includes("g2.com") ||
    d.includes("capterra") ||
    d.includes("trustpilot") ||
    d.includes("getapp")
  )
    return "review";
  if (d.includes("youtube.com") || d.includes("youtu.be")) return "youtube";
  if (d.startsWith("docs.") || d.includes("/docs")) return "docs";
  if (d.includes("blog")) return "blog";
  return "other";
}

// Matches bare domains and full URLs mentioned in the answer text.
const URL_RE = /https?:\/\/[^\s)"'<>]+/gi;
const DOMAIN_RE = /\b([a-z0-9-]+\.)+(com|org|io|net|ai|co|dev|app)\b/gi;

function hostOf(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Analyze which third-party domains the AI answers themselves reference across a
 * brand's latest completed scan. This works without native citation APIs by
 * extracting URLs and bare domains from the answer text. Brand-owned domains are
 * excluded. Returns domains ranked by how often they appear.
 */
export async function analyzeSourceInfluence(
  brandId: string,
): Promise<InfluentialSource[]> {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) return [];

  const latestRun = await db.scanRun.findFirst({
    where: { brandId, status: ScanStatus.DONE },
    orderBy: { startedAt: "desc" },
  });
  if (!latestRun) return [];

  const results = await db.result.findMany({
    where: { scanRunId: latestRun.id },
    select: { responseText: true, citedSources: true },
  });

  const brandHost = brand.domain
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./, "")
    .split("/")[0];

  const byDomain = new Map<string, { mentions: number; sampleUrl?: string }>();

  const bump = (host: string, url?: string) => {
    if (!host || host === brandHost || host.endsWith(`.${brandHost}`)) return;
    const cur = byDomain.get(host) ?? { mentions: 0 };
    cur.mentions += 1;
    if (url && !cur.sampleUrl) cur.sampleUrl = url;
    byDomain.set(host, cur);
  };

  for (const r of results) {
    // Real citations (if any engine provided them) count strongest.
    for (const src of r.citedSources) {
      const host = hostOf(src);
      if (host) bump(host, src);
    }
    // Extract explicit URLs from the answer text.
    for (const url of r.responseText.match(URL_RE) ?? []) {
      const host = hostOf(url);
      if (host) bump(host, url);
    }
    // Extract bare domains named in the answer text.
    for (const m of r.responseText.match(DOMAIN_RE) ?? []) {
      const host = hostOf(m);
      if (host) bump(host);
    }
  }

  return [...byDomain.entries()]
    .map(([domain, v]) => ({
      domain,
      type: classifyDomain(domain),
      mentions: v.mentions,
      sampleUrl: v.sampleUrl,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 25);
}
