"use client";

import { ArrowRight, ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CompetitorTable,
  type CompetitorMentionStat,
  type CompetitorTableRow,
} from "@/components/competitor-table";
import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";
import type { PromptDto } from "@/lib/prompts/types";

type StartKind = "prompts" | "benchmark";

export function OnboardingBenchmark({
  brandId,
  brandName,
  prompts,
  competitors,
  mentionStats,
  initialPromptOperationId,
  initialBenchmarkOperationId,
  benchmarkHasData,
  benchmarkComplete,
  brandMetrics,
  gapCount,
}: {
  brandId: string;
  brandName: string;
  prompts: PromptDto[];
  competitors: CompetitorTableRow[];
  mentionStats: Record<string, CompetitorMentionStat>;
  initialPromptOperationId: string | null;
  initialBenchmarkOperationId: string | null;
  benchmarkHasData: boolean;
  benchmarkComplete: boolean;
  brandMetrics: {
    visibility: number | null;
    shareOfVoice: number | null;
    position: number | null;
    sentiment: number | null;
    sampleSize: number;
  };
  gapCount: number;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [promptOperationId, setPromptOperationId] = useState(
    initialPromptOperationId,
  );
  const [benchmarkOperationId, setBenchmarkOperationId] = useState(
    initialBenchmarkOperationId,
  );
  const [starting, setStarting] = useState<StartKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (kind: StartKind) => {
      setError(null);
      setStarting(kind);
      const endpoint =
        kind === "prompts"
          ? `/api/brands/${brandId}/prompts/generate`
          : `/api/brands/${brandId}/batches`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            kind === "benchmark" ? JSON.stringify({ repetitions: 1 }) : null,
        });
        const payload = (await response.json()) as ApiAccepted | ApiFailure;
        if (response.status !== 202 || !("operationId" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error.message
              : "Could not start AI analysis.",
          );
        }

        if (kind === "prompts") setPromptOperationId(payload.operationId);
        else setBenchmarkOperationId(payload.operationId);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "We could not reach the server. Try again.",
        );
      } finally {
        setStarting(null);
      }
    },
    [brandId],
  );

  const { operation: promptOperation, pollError: promptPollError } =
    useOperationPolling(promptOperationId, (settled) => {
      setPromptOperationId(null);
      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setError(settled.errorMessage ?? "Prompt generation did not complete.");
        return;
      }
      void start("benchmark");
      router.refresh();
    });

  const { operation: benchmarkOperation, pollError: benchmarkPollError } =
    useOperationPolling(benchmarkOperationId, (settled) => {
      setBenchmarkOperationId(null);
      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setError(settled.errorMessage ?? "The AI benchmark did not complete.");
        return;
      }
      router.refresh();
    });

  const progressCurrent = benchmarkOperation?.progressCurrent ?? 0;
  const refreshedProgressRef = useRef(brandMetrics.sampleSize);

  useEffect(() => {
    if (progressCurrent <= refreshedProgressRef.current) return;
    refreshedProgressRef.current = progressCurrent;
    router.refresh();
  }, [progressCurrent, router]);

  useEffect(() => {
    if (startedRef.current || benchmarkComplete) return;
    if (promptOperationId || benchmarkOperationId) return;
    startedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void start(prompts.length > 0 ? "benchmark" : "prompts");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    benchmarkComplete,
    benchmarkOperationId,
    promptOperationId,
    prompts.length,
    start,
  ]);

  const running = Boolean(
    promptOperationId || benchmarkOperationId || starting,
  );

  return (
    <div className="brand-form">
      {(error || promptPollError || benchmarkPollError) && (
        <div className="form-alert" role="alert">
          {error ?? promptPollError ?? benchmarkPollError}
          <button
            className="button button-secondary compact-button"
            type="button"
            onClick={() =>
              void start(prompts.length > 0 ? "benchmark" : "prompts")
            }
          >
            Try again
          </button>
        </div>
      )}

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Prompts analyzed</h2>
            <p>
              The same approved buyer questions from Step 2. Every answer is
              stored and analyzed for brand mentions.
            </p>
          </div>
        </div>

        {prompts.length === 0 ? (
          <div className="benchmark-empty-state">
            <Sparkles size={18} />
            <div>
              <strong>Building prompts from {brandName}&apos;s website…</strong>
              <p>
                We cover category, comparison, use-case, and brand questions.
              </p>
            </div>
          </div>
        ) : (
          <ol className="onboarding-prompt-list">
            {prompts.map((prompt) => (
              <li key={prompt.id}>
                <span>{prompt.type.replace("_", " ")}</span>
                <p>{prompt.text}</p>
              </li>
            ))}
          </ol>
        )}

        {promptOperationId || starting === "prompts" ? (
          <OperationProgress
            operation={promptOperation}
            label="Generating buyer prompts with OpenAI…"
          />
        ) : null}
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Brand benchmark</h2>
            <p>
              Visibility is the share of answers mentioning an entity; rank is
              its average first-mention order; sentiment is judged from the
              language used in those answers.
            </p>
          </div>
        </div>

        {benchmarkHasData ? (
          <>
            <div className="onboarding-metric-strip" aria-label="Brand metrics">
              <div>
                <span>Brand visibility</span>
                <strong>
                  {brandMetrics.visibility == null
                    ? "—"
                    : `${Math.round(brandMetrics.visibility * 100)}%`}
                </strong>
              </div>
              <div>
                <span>Average rank</span>
                <strong>
                  {brandMetrics.position == null
                    ? "—"
                    : `#${brandMetrics.position.toFixed(1)}`}
                </strong>
              </div>
              <div>
                <span>Share of voice</span>
                <strong>
                  {brandMetrics.shareOfVoice == null
                    ? "—"
                    : `${Math.round(brandMetrics.shareOfVoice * 100)}%`}
                </strong>
              </div>
              <div>
                <span>Sentiment</span>
                <strong>
                  {brandMetrics.sentiment == null
                    ? "—"
                    : Math.round(brandMetrics.sentiment)}
                  {brandMetrics.sentiment == null ? null : <small>/100</small>}
                </strong>
              </div>
            </div>
            <div className="benchmark-brands-heading">
              <div>
                <h3>Brands</h3>
                <p>
                  Top {competitors.length} competitors across{" "}
                  {brandMetrics.sampleSize} analyzed answers
                </p>
              </div>
              <span className="status-pill">
                {benchmarkComplete
                  ? "OpenAI Search"
                  : benchmarkOperation && benchmarkOperation.progressTotal > 0
                    ? `Live · ${benchmarkOperation.progressCurrent} of ${benchmarkOperation.progressTotal} answers`
                    : `Live · ${brandMetrics.sampleSize} answers`}
              </span>
            </div>
            <CompetitorTable
              competitors={competitors}
              mentionStats={mentionStats}
            />
          </>
        ) : (
          <div className="benchmark-empty-state">
            <span className="research-spinner" />
            <div>
              <strong>
                {prompts.length === 0
                  ? "Waiting for prompts…"
                  : "Analyzing the first answers in parallel…"}
              </strong>
              <p>Live metrics appear as soon as the first group is ready.</p>
            </div>
          </div>
        )}

        {benchmarkOperationId || starting === "benchmark" ? (
          <OperationProgress
            operation={benchmarkOperation}
            label="Analyzing AI answers in parallel…"
            unitLabel="AI answers analyzed"
          />
        ) : null}
      </section>

      {benchmarkComplete && gapCount > 0 ? (
        <Link className="gap-tease" href={`/projects/${brandId}/opportunities`}>
          <Sparkles size={18} />
          <div>
            <strong>
              {gapCount} gap opportunit{gapCount === 1 ? "y" : "ies"} found
            </strong>
            <p>
              See where competitors are cited more often than you in AI answers.
            </p>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      ) : null}

      <div className="form-actions">
        <p>
          {benchmarkComplete
            ? "Your first evidence-backed benchmark is ready."
            : "You can leave this screen; the durable analysis will continue."}
        </p>
        {benchmarkComplete ? (
          <Link
            className="button button-primary button-large"
            href={`/projects/${brandId}/overview`}
          >
            Open dashboard <ArrowRight size={16} />
          </Link>
        ) : (
          <button
            className="button button-primary button-large"
            type="button"
            disabled={running}
            onClick={() =>
              void start(prompts.length > 0 ? "benchmark" : "prompts")
            }
          >
            {running ? "Analysis running…" : "Start analysis"}
          </button>
        )}
      </div>

      {benchmarkComplete ? (
        <p className="benchmark-complete-note">
          <CheckCircle2 size={15} /> Metrics come from stored prompt runs, not
          estimates.
        </p>
      ) : null}
    </div>
  );
}
