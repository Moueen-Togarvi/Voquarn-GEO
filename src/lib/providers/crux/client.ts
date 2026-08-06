export type CruxMetrics = {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
};

type CruxApiResponse = {
  record?: {
    metrics?: {
      largest_contentful_paint?: { percentiles?: { p75?: number | string } };
      interaction_to_next_paint?: { percentiles?: { p75?: number | string } };
      cumulative_layout_shift?: { percentiles?: { p75?: number | string } };
    };
  };
};

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Pure — maps the CrUX API's raw p75 percentiles (LCP/INP/CLS only, per the plan) onto PerformanceObservation's shape. */
export function mapCruxMetrics(payload: CruxApiResponse): CruxMetrics {
  const metrics = payload.record?.metrics;
  return {
    lcp: toNumber(metrics?.largest_contentful_paint?.percentiles?.p75),
    inp: toNumber(metrics?.interaction_to_next_paint?.percentiles?.p75),
    cls: toNumber(metrics?.cumulative_layout_shift?.percentiles?.p75),
  };
}

const CRUX_ENDPOINT =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

/**
 * Google's Chrome UX Report API — real-user FIELD performance data, not a
 * synthetic lab test. Structurally complete against the documented API but
 * never exercised against a live key in this environment — verify before
 * relying on it in production, same caveat as every other external
 * provider client built this session.
 */
export class CruxClient {
  constructor(private readonly apiKey = process.env.CRUX_API_KEY) {}

  /** Returns null (not an error) when CrUX has no data for this URL yet — a real, common outcome for lower-traffic pages, not a failure. */
  async queryUrl(url: string): Promise<CruxMetrics | null> {
    if (!this.apiKey) {
      throw new Error(
        "CRUX_API_KEY is not configured. Field performance data is disabled until it is provided.",
      );
    }

    const response = await fetch(
      `${CRUX_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`CrUX request failed (${response.status}).`);
    }

    const payload = (await response.json()) as CruxApiResponse;
    return mapCruxMetrics(payload);
  }
}
