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
import { PageHeader } from "@/components/page-header";
import { getBrand } from "@/lib/brands/service";

export const metadata = { title: "Overview" };

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Overview"
        title={`Good to have ${brand.name} here.`}
        description="Your project foundation is ready. Complete the next steps to start measuring AI visibility."
        action={
          <button
            className="button button-primary"
            disabled
            title="Available in the prompt tracking milestone"
          >
            <Play size={16} fill="currentColor" /> Run analysis
          </button>
        }
      />

      <section className="metric-grid" aria-label="Future visibility metrics">
        {[
          ["Visibility", "—", "Chats mentioning your brand"],
          ["Share of voice", "—", "Mentions vs competitors"],
          ["Sentiment", "—", "How AI describes you"],
          ["Position", "—", "Average mention order"],
        ].map(([label, value, caption]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </section>

      <div className="overview-grid">
        <section className="content-card setup-card">
          <div className="card-heading">
            <div>
              <p className="page-eyebrow">Getting started</p>
              <h2>Your measurement setup</h2>
            </div>
            <span className="progress-label">1 of 3</span>
          </div>
          <div className="progress-track">
            <span style={{ width: "33.333%" }} />
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
            <Link className="setup-item" href={`/projects/${brand.id}/prompts`}>
              <span className="setup-status">
                <Circle size={16} />
              </span>
              <div>
                <strong>Build your prompt library</strong>
                <p>Generate and approve realistic buyer questions.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
            <div className="setup-item disabled">
              <span className="setup-status">
                <Circle size={16} />
              </span>
              <div>
                <strong>Run your first analysis</strong>
                <p>Measure mentions, position, sentiment, and sources.</p>
              </div>
            </div>
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
                <FileQuestion size={15} /> Not configured
              </dd>
            </div>
            <div>
              <dt>Primary model</dt>
              <dd>
                <span className="model-dot" /> GLM-5.1
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
