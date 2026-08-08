import {
  ArrowUpRight,
  Check,
  Circle,
  FileQuestion,
  Play,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetitorMentionStats,
  getLatestAggregate,
} from "@/lib/benchmark/service";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { TagList } from "@/components/tag-list";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { resolveDefault } from "@/lib/llm/registry";
import { listActivePrompts } from "@/lib/prompts/service";

export const metadata = { title: "Overview" };

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function dominantSentiment(dist: Record<string, number> | undefined): string {
  if (!dist) return "—";
  const entries = Object.entries(dist).filter(([, count]) => count > 0);
  if (entries.length === 0) return "—";
  const [label] = entries.reduce((best, entry) =>
    entry[1] > best[1] ? entry : best,
  );
  return label.charAt(0) + label.slice(1).toLowerCase();
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

  const [activePrompts, latest, mentionStats] = await Promise.all([
    listActivePrompts(ctx, brand.id),
    getLatestAggregate(ctx, brand.id),
    getCompetitorMentionStats(ctx, brand.id),
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
        />
        <MetricCard
          label="Share of voice"
          value={formatPercent(latest?.aggregate.shareOfVoice)}
          caption="Mentions vs competitors"
        />
        <MetricCard
          label="Sentiment"
          value={dominantSentiment(latest?.aggregate.sentimentDist)}
          caption="How AI describes you"
        />
        <MetricCard
          label="Position"
          value={
            latest?.aggregate.avgPosition != null
              ? latest.aggregate.avgPosition.toFixed(1)
              : "—"
          }
          caption="Average mention order"
        />
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
                <Users size={15} /> {brand.competitors.length} tracked (
                {topTierCount} top-tier)
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
