import {
  normalizeCitationShare,
  normalizeProminence,
  normalizeSerpOverlap,
} from "@/lib/scoring/normalize";
import type { ThreatComponentInputs } from "@/lib/scoring/threat-v1";

export type ObservationInput = {
  keywordId: string;
  position: number;
  /** ISO timestamp of the SerpSnapshot the observation came from. */
  snapshotFetchedAt: string;
};

/**
 * Keeps only the most recent observation per keyword. A competitor tracked
 * across many historical snapshots must be counted once per keyword's
 * *current* state for scoring, not once per snapshot ever taken — otherwise
 * a keyword hunted daily for a month would outweigh one hunted once.
 */
export function latestObservationPerKeyword(
  observations: ObservationInput[],
): ObservationInput[] {
  const latest = new Map<string, ObservationInput>();
  for (const observation of observations) {
    const current = latest.get(observation.keywordId);
    if (!current || observation.snapshotFetchedAt > current.snapshotFetchedAt) {
      latest.set(observation.keywordId, observation);
    }
  }
  return [...latest.values()];
}

export type ThreatEvidenceInput = {
  observations: ObservationInput[];
  totalTrackedKeywords: number;
  competitorMentions: number;
  brandMentions: number;
};

export type ThreatComponentInputsResult = {
  inputs: ThreatComponentInputs;
  /** Distinct keywords this competitor was actually observed in — the primary "how much evidence" figure shown alongside a score. */
  evidenceCount: number;
};

/**
 * Turns raw CompetitorObservation rows and Phase 2 benchmark mention totals
 * into the normalized component inputs computeThreatScore() expects.
 * authorityProxy, freshness, and backlinks are always null here — see the
 * reserved-slot comment on THREAT_COMPONENT_WEIGHTS in
 * src/lib/scoring/threat-v1.ts.
 */
export function buildThreatComponentInputs(
  evidence: ThreatEvidenceInput,
): ThreatComponentInputsResult {
  const latest = latestObservationPerKeyword(evidence.observations);
  const positions = latest.map((observation) => observation.position);

  const inputs: ThreatComponentInputs = {
    serpOverlap: normalizeSerpOverlap(
      latest.length,
      evidence.totalTrackedKeywords,
    ),
    prominence: normalizeProminence(positions),
    citationShare: normalizeCitationShare(
      evidence.competitorMentions,
      evidence.brandMentions,
    ),
    authorityProxy: null,
    freshness: null,
    backlinks: null,
  };

  return { inputs, evidenceCount: latest.length };
}
