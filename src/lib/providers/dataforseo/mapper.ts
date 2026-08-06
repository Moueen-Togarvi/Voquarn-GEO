import { registrableDomain } from "@/lib/domains/canonical";
import type {
  SerpLiveResponse,
  SerpItem,
} from "@/lib/providers/dataforseo/types";

export type MappedSerpResult = {
  position: number;
  url: string;
  domain: string;
  registrableDomain: string;
  title: string | null;
  snippet: string | null;
  type: "ORGANIC" | "AI_OVERVIEW" | "PAA" | "VIDEO" | "LOCAL";
};

function domainOf(url: string, fallback: string | null | undefined): string {
  if (fallback) return fallback.toLowerCase();
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function mapOrganic(item: SerpItem): MappedSerpResult | null {
  if (!item.url || item.rank_absolute == null) return null;
  const domain = domainOf(item.url, item.domain);
  return {
    position: item.rank_absolute,
    url: item.url,
    domain,
    registrableDomain: registrableDomain(domain),
    title: item.title ?? null,
    snippet: item.description ?? null,
    type: "ORGANIC",
  };
}

function mapVideo(item: SerpItem): MappedSerpResult | null {
  if (!item.url || item.rank_absolute == null) return null;
  const domain = domainOf(item.url, item.domain);
  return {
    position: item.rank_absolute,
    url: item.url,
    domain,
    registrableDomain: registrableDomain(domain),
    title: item.title ?? null,
    snippet: item.description ?? null,
    type: "VIDEO",
  };
}

function mapLocal(item: SerpItem): MappedSerpResult | null {
  if (!item.url || item.rank_absolute == null) return null;
  const domain = domainOf(item.url, item.domain);
  return {
    position: item.rank_absolute,
    url: item.url,
    domain,
    registrableDomain: registrableDomain(domain),
    title: item.title ?? null,
    snippet: item.description ?? null,
    type: "LOCAL",
  };
}

/** An AI Overview block cites zero or more reference pages — each becomes its own SerpResult, all sharing the block's own position. */
function mapAiOverview(item: SerpItem): MappedSerpResult[] {
  if (item.rank_absolute == null || !item.references) return [];
  return item.references
    .filter((reference): reference is typeof reference & { url: string } =>
      Boolean(reference.url),
    )
    .map((reference) => {
      const domain = domainOf(reference.url, reference.domain);
      return {
        position: item.rank_absolute as number,
        url: reference.url,
        domain,
        registrableDomain: registrableDomain(domain),
        title: reference.title ?? null,
        snippet: null,
        type: "AI_OVERVIEW" as const,
      };
    });
}

/** A "People Also Ask" block expands into sub-questions; only ones DataForSEO resolved to a concrete source page are mappable to a SerpResult. */
function mapPeopleAlsoAsk(item: SerpItem): MappedSerpResult[] {
  if (item.rank_absolute == null || !Array.isArray(item.items)) return [];

  const results: MappedSerpResult[] = [];
  for (const rawSub of item.items) {
    const sub = rawSub as {
      expanded_element?: Array<{
        url?: string | null;
        domain?: string | null;
        title?: string | null;
        description?: string | null;
      }>;
    };
    for (const expanded of sub.expanded_element ?? []) {
      if (!expanded.url) continue;
      const domain = domainOf(expanded.url, expanded.domain);
      results.push({
        position: item.rank_absolute as number,
        url: expanded.url,
        domain,
        registrableDomain: registrableDomain(domain),
        title: expanded.title ?? null,
        snippet: expanded.description ?? null,
        type: "PAA",
      });
    }
  }
  return results;
}

/**
 * Pure: turns one already-Zod-validated DataForSEO SERP response into the
 * flat SerpResult rows huntSerpFetch persists, plus the resultCount that
 * lands on SerpSnapshot. Only the first task's first result is read — a
 * single-keyword request always produces exactly one of each.
 */
export function mapSerpResponse(response: SerpLiveResponse): {
  results: MappedSerpResult[];
  resultCount: number;
} {
  const taskResult = response.tasks?.[0]?.result?.[0];
  if (!taskResult?.items) {
    return { results: [], resultCount: 0 };
  }

  const results: MappedSerpResult[] = [];
  for (const item of taskResult.items) {
    switch (item.type) {
      case "organic": {
        const mapped = mapOrganic(item);
        if (mapped) results.push(mapped);
        break;
      }
      case "video": {
        const mapped = mapVideo(item);
        if (mapped) results.push(mapped);
        break;
      }
      case "local_pack":
      case "map": {
        const mapped = mapLocal(item);
        if (mapped) results.push(mapped);
        break;
      }
      case "ai_overview":
        results.push(...mapAiOverview(item));
        break;
      case "people_also_ask":
        results.push(...mapPeopleAlsoAsk(item));
        break;
      default:
        // Unrecognized item types (featured_snippet, knowledge_graph,
        // related_searches, ...) are intentionally not mapped in v1 —
        // skipping is safer than guessing at an unfamiliar shape.
        break;
    }
  }

  return {
    results,
    resultCount: taskResult.items_count ?? results.length,
  };
}
