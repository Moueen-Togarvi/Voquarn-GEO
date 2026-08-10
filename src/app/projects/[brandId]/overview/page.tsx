import {
  ArrowUpRight,
  Check,
  Circle,
  FileQuestion,
  Play,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetitorMentionStats,
  getLatestAggregate,
  listBatchSummaries,
} from "@/lib/benchmark/service";
import { sentimentScore } from "@/lib/benchmark/aggregate";
import { MetricCard, type MetricTrend } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { TagList } from "@/components/tag-list";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getAiCrawlerAccess } from "@/lib/crawl/service";
import { resolveDefault } from "@/lib/llm/registry";
import { detectCitationGaps } from "@/lib/opportunity/detectors";
import { getBenchmarkCitationShares } from "@/lib/opportunity/service";
import { listActivePrompts } from "@/lib/prompts/service";

export const metadata = { title: "Overview" };

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function toSentimentScore(
  dist: Record<string, number> | null | undefined,
): number | null {
  if (!dist) return null;
  return sentimentScore({
    POSITIVE: dist.POSITIVE ?? 0,
    NEUTRAL: dist.NEUTRAL ?? 0,
    NEGATIVE: dist.NEGATIVE ?? 0,
  });
}

/** Position is inverted: a lower average mention order is better, unlike every other metric here where higher is better. */
function trendFor(
  current: number | null,
  previous: number | null,
  options: { invert?: boolean; suffix?: string; digits?: number } = {},
): MetricTrend | undefined {
  if (current == null || previous == null) return undefined;
  const delta = current - previous;
  const digits = options.digits ?? 0;
  const rounded = Math.abs(delta) < 0.5 * 10 ** -digits ? 0 : delta;
  if (rounded === 0) return { direction: "flat", label: "No change" };
  const improved = options.invert ? rounded < 0 : rounded > 0;
  const magnitude = Math.abs(rounded).toFixed(digits);
  const suffix = options.suffix ?? "";
  return {
    direction: improved ? "up" : "down",
    label: `${rounded > 0 ? "+" : "-"}${magnitude}${suffix} vs last run`,
  };
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const [
    activePrompts,
    latest,
    mentionStats,
    batchSummaries,
    crawlerAccess,
    citationShares,
  ] = await Promise.all([
    listActivePrompts(ctx, brand.id),
    getLatestAggregate(ctx, brand.id),
    getCompetitorMentionStats(ctx, brand.id),
    listBatchSummaries(ctx, brand.id),
    getAiCrawlerAccess(brand.domain),
    getBenchmarkCitationShares(ctx, brand.id),
  ]);
  const model = resolveDefault("benchmark");

  const hasPrompts = activePrompts.length > 0;
  const hasRun = latest !== null;
  const stepsComplete = 1 + Number(hasPrompts) + Number(hasRun);

  const topTierCount = brand.competitors.filter(
    (competitor) => competitor.tier === "TOP",
  ).length;
  const topMention = Object.values(mentionStats.stats)
    .filter((stat) => stat.mentionCount > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)[0];
  const mostMentioned = topMention
    ? {
        mentionCount: topMention.mentionCount,
        competitor: brand.competitors.find(
          (c) => c.id === topMention.competitorId,
        ),
      }
    : null;

  const sentimentValue = toSentimentScore(latest?.aggregate.sentimentDist);
  const previousAggregate = batchSummaries.filter((batch) => batch.aggregate)[1]
    ?.aggregate;
  const previousSentiment = toSentimentScore(previousAggregate?.sentimentDist);

  const blockedBots = crawlerAccess.filter((entry) => !entry.allowed);
  const citationGaps = detectCitationGaps(citationShares);
  const topGap = [...citationGaps].sort(
    (a, b) => (b.components.gapSeverity ?? 0) - (a.components.gapSeverity ?? 0),
  )[0];

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Overview"
        title={`Good to have ${brand.name} here.`}
        description="Your project foundation is ready. Complete the next steps to start measuring AI visibility."
        action={
          <Link
            className="button button-primary"
            href={`/projects/${brand.id}/runs`}
          >
            <Play size={16} fill="currentColor" /> Run analysis
          </Link>
        }
      />

      <section className="metric-grid" aria-label="Visibility metrics">
        <MetricCard
          label="Visibility"
          value={formatPercent(latest?.aggregate.visibility)}
          caption="Runs mentioning your brand"
          trend={trendFor(
            latest?.aggregate.visibility ?? null,
            previousAggregate?.visibility ?? null,
            { suffix: "pts", digits: 0 },
          )}
        />
        <MetricCard
          label="Share of voice"
          value={formatPercent(latest?.aggregate.shareOfVoice)}
          caption="Mentions vs competitors"
          trend={trendFor(
            latest?.aggregate.shareOfVoice ?? null,
            previousAggregate?.shareOfVoice ?? null,
            { suffix: "pts", digits: 0 },
          )}
        />
        <MetricCard
          label="Sentiment"
          value={sentimentValue == null ? "—" : `${Math.round(sentimentValue)}`}
          caption="How AI describes you, out of 100"
          trend={trendFor(sentimentValue, previousSentiment, { digits: 0 })}
        />
        <MetricCard
          label="Position"
          value={
            latest?.aggregate.avgPosition != null
              ? latest.aggregate.avgPosition.toFixed(1)
              : "—"
          }
          caption="Average mention order"
          trend={trendFor(
            latest?.aggregate.avgPosition ?? null,
            previousAggregate?.avgPosition ?? null,
            { invert: true, digits: 1 },
          )}
        />
      </section>

      {citationGaps.length > 0 && topGap ? (
        <Link
          className="gap-tease"
          href={`/projects/${brand.id}/opportunities`}
        >
          <Sparkles size={18} />
          <div>
            <strong>
              {citationGaps.length} gap opportunit
              {citationGaps.length === 1 ? "y" : "ies"} found
            </strong>
            <p>
              {topGap.title} — see where competitors are cited more than you.
            </p>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      ) : null}

      <section className="content-card">
        <div className="card-heading">
          <div>
            <p className="page-eyebrow">GEO health</p>
            <h2>AI crawler access</h2>
          </div>
        </div>
        {crawlerAccess.length === 0 ? (
          <p className="muted-text">
            Re-analyze this project to check whether AI crawlers can read your
            site.
          </p>
        ) : blockedBots.length === 0 ? (
          <p className="muted-text">
            All {crawlerAccess.length} tracked AI crawlers (GPTBot, ClaudeBot,
            PerplexityBot, and others) can access your site.
          </p>
        ) : (
          <>
            <p className="muted-text">
              {blockedBots.length} of {crawlerAccess.length} AI crawlers are
              blocked from reading your site — they can&apos;t cite what they
              can&apos;t see.
            </p>
            <div className="crawler-audit-list">
              {blockedBots.map((entry) => (
                <div className="crawler-audit-item" key={entry.botName}>
                  <ShieldAlert size={15} />
                  <div>
                    <strong>{entry.botName}</strong>
                    <p>{entry.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="content-card">
        <div className="card-heading">
          <div>
            <p className="page-eyebrow">Profile</p>
            <h2>What we know about {brand.name}</h2>
          </div>
        </div>
        <TagList
          groups={[
            { label: "Products & services", items: brand.services },
            { label: "Target audiences", items: brand.audiences },
            { label: "Buyer pain points", items: brand.painPoints },
            { label: "Blog & resource themes", items: brand.contentThemes },
            { label: "Differentiators", items: brand.differentiators },
          ]}
        />
      </section>

      <div className="overview-grid">
        <section className="content-card setup-card">
          <div className="card-heading">
            <div>
              <p className="page-eyebrow">Getting started</p>
              <h2>Your measurement setup</h2>
            </div>
            <span className="progress-label">{stepsComplete} of 3</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${(stepsComplete / 3) * 100}%` }} />
          </div>
          <div className="setup-list">
            <div className="setup-item complete">
              <span className="setup-status">
                <Check size={16} />
              </span>
              <div>
                <strong>Brand profile created</strong>
                <p>
                  {brand.domain} · {brand.category}
                </p>
              </div>
            </div>
            <Link
              className={`setup-item${hasPrompts ? "complete" : ""}`}
              href={`/projects/${brand.id}/prompts`}
            >
              <span className="setup-status">
                {hasPrompts ? <Check size={16} /> : <Circle size={16} />}
              </span>
              <div>
                <strong>Build your prompt library</strong>
                <p>Generate and approve realistic buyer questions.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
            <Link
              className={`setup-item${hasRun ? "complete" : ""}`}
              href={`/projects/${brand.id}/runs`}
            >
              <span className="setup-status">
                {hasRun ? <Check size={16} /> : <Circle size={16} />}
              </span>
              <div>
                <strong>Run your first analysis</strong>
                <p>Measure mentions, position, sentiment, and sources.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>

        <aside className="content-card project-summary">
          <div className="card-heading">
            <div>
              <p className="page-eyebrow">Project</p>
              <h2>Tracking profile</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{brand.category}</dd>
            </div>
            <div>
              <dt>Competitors</dt>
              <dd>
                <Users size={15} /> {topTierCount} of 30 direct competitors
              </dd>
            </div>
            {mostMentioned?.competitor ? (
              <div>
                <dt>Most mentioned</dt>
                <dd>
                  <Link href={`/projects/${brand.id}/competitors`}>
                    {mostMentioned.competitor.name}
                  </Link>{" "}
                  ({mostMentioned.mentionCount} mentions)
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Prompts</dt>
              <dd>
                <FileQuestion size={15} />{" "}
                {hasPrompts
                  ? `${activePrompts.length} active`
                  : "Not configured"}
              </dd>
            </div>
            <div>
              <dt>Primary model</dt>
              <dd>
                <span className="model-dot" /> {model.model}
              </dd>
            </div>
          </dl>
          <Link
            className="button button-secondary full-button"
            href={`/projects/${brand.id}/settings`}
          >
            Review project settings
          </Link>
        </aside>
      </div>
    </div>
  );
}
