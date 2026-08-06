import type { Market } from "@/generated/prisma/client";
import type { MarketDevice } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type MarketDto = {
  id: string;
  country: string;
  region: string | null;
  city: string | null;
  language: string;
  device: MarketDevice;
  timezone: string;
};

function toMarketDto(market: Market): MarketDto {
  return {
    id: market.id,
    country: market.country,
    region: market.region,
    city: market.city,
    language: market.language,
    device: market.device,
    timezone: market.timezone,
  };
}

export type MarketInput = {
  country: string;
  region?: string | null;
  city?: string | null;
  language: string;
  device?: MarketDevice;
  timezone: string;
};

/**
 * Reuses an existing market for this workspace when the (country, region,
 * city, language, device) tuple already matches, rather than creating a
 * duplicate. Not done as a DB-level upsert: Postgres treats every NULL in a
 * unique index as distinct from every other NULL, so a compound unique
 * constraint including the nullable region/city columns cannot actually
 * enforce this — a plain findFirst-then-create is the correct tool here,
 * and the race window it leaves (two concurrent onboarding submissions
 * creating the same market) is an acceptable, low-likelihood cost for a
 * per-workspace setup action.
 */
export async function findOrCreateMarket(
  ctx: WorkspaceContext,
  input: MarketInput,
): Promise<MarketDto> {
  const device = input.device ?? "DESKTOP";
  const region = input.region ?? null;
  const city = input.city ?? null;

  const existing = await scopedDb(ctx).market.findFirst({
    where: {
      country: input.country,
      region,
      city,
      language: input.language,
      device,
    },
  });
  if (existing) {
    return toMarketDto(existing);
  }

  const created = await scopedDb(ctx).market.create({
    data: {
      workspaceId: ctx.workspaceId,
      country: input.country,
      region,
      city,
      language: input.language,
      device,
      timezone: input.timezone,
    },
  });

  return toMarketDto(created);
}

export async function listMarkets(ctx: WorkspaceContext): Promise<MarketDto[]> {
  const markets = await scopedDb(ctx).market.findMany({
    orderBy: { createdAt: "asc" },
  });
  return markets.map(toMarketDto);
}
