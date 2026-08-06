import type { Source } from "@/generated/prisma/client";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type SourceDto = {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  snippet: string | null;
  isCitation: boolean;
  createdAt: string;
};

export type SourceDomainSummaryDto = {
  domain: string;
  count: number;
  citationCount: number;
};

function toSourceDto(source: Source): SourceDto {
  return {
    id: source.id,
    url: source.url,
    domain: source.domain,
    title: source.title,
    snippet: source.snippet,
    isCitation: source.isCitation,
    createdAt: source.createdAt.toISOString(),
  };
}

/**
 * A Source anchors to whichever call produced it — a PromptRun (benchmark
 * runs) or directly a ProviderCall (brand discovery and everything else
 * with no PromptRun to attach to). "For a brand" therefore means following
 * either path down to that brand's id. See the Source model comment in
 * schema.prisma.
 */
export async function listSourcesForBrand(
  ctx: WorkspaceContext,
  brandId: string,
  options: { limit?: number } = {},
): Promise<SourceDto[]> {
  const sources = await scopedDb(ctx).source.findMany({
    where: {
      OR: [
        { promptRun: { prompt: { brandId } } },
        { providerCall: { operation: { brandId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 200,
  });

  return sources.map(toSourceDto);
}

/** Domains ranked by how often they were retrieved, with how many were actual citations. */
export async function listSourceDomainSummary(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<SourceDomainSummaryDto[]> {
  const sources = await listSourcesForBrand(ctx, brandId, { limit: 1000 });

  const byDomain = new Map<string, { count: number; citationCount: number }>();
  for (const source of sources) {
    const entry = byDomain.get(source.domain) ?? { count: 0, citationCount: 0 };
    entry.count += 1;
    if (source.isCitation) entry.citationCount += 1;
    byDomain.set(source.domain, entry);
  }

  return [...byDomain.entries()]
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.count - a.count);
}
