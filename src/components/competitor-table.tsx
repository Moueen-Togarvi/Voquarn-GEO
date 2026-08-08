"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type CompetitorTableRow = {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;
  country: string | null;
};

export type CompetitorMentionStat = {
  mentionCount: number;
  visibility: number | null;
  shareOfVoice: number | null;
  avgPosition: number | null;
};

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function formatPosition(value: number | null | undefined): string {
  return value == null ? "—" : `#${Math.round(value)}`;
}

/**
 * The shared competitor columns: name, website, country, and (when
 * mentionStats is supplied) the peec.ai-style visibility/share-of-voice/
 * position/mentions figures computed from RunAnalysis data. `review` turns
 * on an inline accept/ignore toggle per row for the onboarding step —
 * omitted everywhere else, since post-onboarding pages only ever show
 * already-ACCEPTED/PINNED competitors.
 */
export function CompetitorTable({
  competitors,
  mentionStats,
  linkBase,
  review,
}: {
  competitors: CompetitorTableRow[];
  mentionStats?: Record<string, CompetitorMentionStat>;
  linkBase?: (competitorId: string) => string;
  review?: {
    acceptedIds: Set<string>;
    onToggle: (id: string) => void;
    pending?: boolean;
  };
}) {
  if (competitors.length === 0) {
    return <p className="muted-text">No competitors in this tier yet.</p>;
  }

  return (
    <div className="run-table-wrap">
      <table className="run-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Website</th>
            <th scope="col">Country</th>
            {mentionStats ? (
              <>
                <th scope="col">Visibility</th>
                <th scope="col">Share of voice</th>
                <th scope="col">Position</th>
                <th scope="col">Mentions</th>
              </>
            ) : null}
            {review ? <th scope="col">Tracking</th> : null}
          </tr>
        </thead>
        <tbody>
          {competitors.map((competitor) => {
            const stat = mentionStats?.[competitor.id];
            const accepted = review?.acceptedIds.has(competitor.id);
            const nameContent = linkBase ? (
              <Link href={linkBase(competitor.id)}>{competitor.name}</Link>
            ) : (
              competitor.name
            );

            return (
              <tr key={competitor.id}>
                <td>
                  <strong>{nameContent}</strong>
                  <br />
                  <small className="muted-text">{competitor.domain}</small>
                </td>
                <td>
                  <a
                    href={competitor.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {competitor.domain}
                  </a>
                </td>
                <td>{competitor.country ?? "—"}</td>
                {mentionStats ? (
                  <>
                    <td>{formatPercent(stat?.visibility)}</td>
                    <td>{formatPercent(stat?.shareOfVoice)}</td>
                    <td>{formatPosition(stat?.avgPosition)}</td>
                    <td>{stat?.mentionCount ?? "—"}</td>
                  </>
                ) : null}
                {review ? (
                  <td>
                    <button
                      type="button"
                      className={cn("status-pill", accepted && "success")}
                      aria-pressed={accepted}
                      disabled={review.pending}
                      onClick={() => review.onToggle(competitor.id)}
                    >
                      {accepted ? (
                        <>
                          <Check size={12} /> Tracking
                        </>
                      ) : (
                        <>
                          <X size={12} /> Ignored
                        </>
                      )}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
