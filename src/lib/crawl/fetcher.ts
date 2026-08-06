import {
  assertPublicWebsiteUrl,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";
import { fetchPinned } from "@/lib/net/pinned-agent";

export { UnsafeWebsiteError };

export const DEFAULT_CRAWLER_USER_AGENT =
  "Voquarn-GEO-Crawler/1.0 (+https://voquarn.com/crawler)";

const DEFAULT_MAX_BYTES = 3_000_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export type CrawlFetchResult = {
  finalUrl: string;
  httpStatus: number;
  html: string;
  lastModified: string | null;
  contentType: string | null;
};

export type CrawlFetchOutcome =
  | { kind: "ok"; result: CrawlFetchResult }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; reason: string };

/**
 * Reads a response body up to `maxBytes` of *decompressed* bytes, aborting
 * the underlying stream the instant the cap is crossed. This is the actual
 * gzip-bomb defense — a Content-Length header only bounds the bytes on the
 * wire, and `fetch` transparently decompresses gzip/br/deflate before this
 * code ever sees the body, so a small compressed response can still expand
 * to an unbounded amount of memory if read via response.text()/
 * arrayBuffer() directly. Streaming with a hard cap is what actually stops
 * that, independent of whatever the server claims Content-Length is.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? null : buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

type HopOutcome =
  | { kind: "redirect"; location: string }
  | { kind: "ok"; result: CrawlFetchResult }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; reason: string };

/**
 * Fetches one URL for the crawler: SSRF-validated and IP-pinned exactly
 * like src/lib/discovery/website.ts (re-validated and re-pinned on every
 * redirect hop, since a redirect can point anywhere, including back into a
 * private network), plus a decompressed-size cap and a content-type
 * allowlist that discovery's single-page fetch doesn't need. Unlike
 * discovery, a non-2xx status is not treated as failure — a 404 or 500 is
 * itself crawl data worth recording, so it comes back as `kind: "ok"` with
 * the real httpStatus; only genuinely unsafe or oversized responses are
 * "blocked", and transport failures are "error".
 */
export async function fetchPageForCrawl(
  targetUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    userAgent?: string;
    /** Defaults to HTML only; pass a wider list (or null to skip the check entirely) for non-HTML text resources like robots.txt or sitemap.xml. */
    allowedContentTypes?: string[] | null;
  } = {},
): Promise<CrawlFetchOutcome> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? DEFAULT_CRAWLER_USER_AGENT;
  const allowedContentTypes =
    options.allowedContentTypes === undefined
      ? ALLOWED_CONTENT_TYPES
      : options.allowedContentTypes;

  let currentUrl = targetUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    let validated: { address: string } | null;
    try {
      validated = await assertPublicWebsiteUrl(currentUrl);
    } catch (error) {
      if (error instanceof UnsafeWebsiteError) {
        return { kind: "blocked", reason: error.message };
      }
      throw error;
    }
    if (!validated) {
      return { kind: "error", reason: "DNS lookup failed." };
    }

    const hopUrl = currentUrl;
    let hopOutcome: HopOutcome;
    try {
      hopOutcome = await fetchPinned(
        hopUrl,
        validated.address,
        {
          redirect: "manual",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": userAgent,
          },
          signal: AbortSignal.timeout(timeoutMs),
        },
        async (response): Promise<HopOutcome> => {
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) {
              return {
                kind: "error",
                reason: "Redirect with no Location header.",
              };
            }
            return {
              kind: "redirect",
              location: new URL(location, hopUrl).toString(),
            };
          }

          const contentType =
            response.headers.get("content-type")?.toLowerCase() ?? null;
          if (
            allowedContentTypes &&
            contentType &&
            !allowedContentTypes.some((allowed) =>
              contentType.includes(allowed),
            )
          ) {
            return {
              kind: "blocked",
              reason: `Unsupported content type: ${contentType}`,
            };
          }

          const contentLength = Number(response.headers.get("content-length"));
          if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            return {
              kind: "blocked",
              reason: "Content-Length exceeds the crawl size limit.",
            };
          }

          const body = await readCapped(response, maxBytes);
          if (body === null) {
            return {
              kind: "blocked",
              reason: "Response body exceeded the crawl size limit.",
            };
          }

          return {
            kind: "ok",
            result: {
              finalUrl: hopUrl,
              httpStatus: response.status,
              html: body.toString("utf-8"),
              lastModified: response.headers.get("last-modified"),
              contentType,
            },
          };
        },
      );
    } catch (error) {
      return {
        kind: "error",
        reason: error instanceof Error ? error.message : "Fetch failed.",
      };
    }

    if (hopOutcome.kind !== "redirect") return hopOutcome;
    if (redirect === MAX_REDIRECTS) {
      return { kind: "error", reason: "Too many redirects." };
    }
    currentUrl = hopOutcome.location;
  }

  return { kind: "error", reason: "Too many redirects." };
}
