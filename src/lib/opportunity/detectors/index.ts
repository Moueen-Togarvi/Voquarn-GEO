import { detectComparisonGap } from "@/lib/opportunity/detectors/comparison";
import { detectIntentMismatch } from "@/lib/opportunity/detectors/intent-mismatch";
import { detectMissingCoverage } from "@/lib/opportunity/detectors/missing-coverage";
import { detectStale } from "@/lib/opportunity/detectors/stale";
import { detectWeakCoverage } from "@/lib/opportunity/detectors/weak-coverage";
import type { DetectedGap, TopicCoverage } from "@/lib/opportunity/types";

export { detectMissingCoverage } from "@/lib/opportunity/detectors/missing-coverage";
export { detectWeakCoverage } from "@/lib/opportunity/detectors/weak-coverage";
export { detectStale } from "@/lib/opportunity/detectors/stale";
export { detectIntentMismatch } from "@/lib/opportunity/detectors/intent-mismatch";
export { detectComparisonGap } from "@/lib/opportunity/detectors/comparison";
export {
  detectCitationGaps,
  type CitationGapInput,
} from "@/lib/opportunity/detectors/citation-gap";

/** Every topic-scoped detector, run against one TopicCoverage. A topic can surface more than one kind of gap at once (e.g. both stale AND weak). */
export function runTopicDetectors(
  coverage: TopicCoverage,
  now: Date = new Date(),
): DetectedGap[] {
  return [
    detectMissingCoverage(coverage),
    detectWeakCoverage(coverage),
    detectStale(coverage, now),
    detectIntentMismatch(coverage),
    detectComparisonGap(coverage),
  ].filter((gap): gap is DetectedGap => gap !== null);
}
