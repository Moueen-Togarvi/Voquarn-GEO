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
import { getLatestAggregate } from "@/lib/benchmark/service";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
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

  const [activePrompts, latest] = await Promise.all([
    listActivePrompts(ctx, brand.id),
    getLatestAggregate(ctx, brand.id),
  ]);
  const model = resolveDefault("benchmark");

  const hasPrompts = activePrompts.length > 0;
  const hasRun = latest !== null;
  const stepsComplete = 1 + Number(hasPrompts) + Number(hasRun);

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
                <Users size={15} /> {brand.competitors.length} tracked
              </dd>
            </div>
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
