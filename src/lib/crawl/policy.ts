import { DEFAULT_CRAWLER_USER_AGENT } from "@/lib/crawl/fetcher";
import { isAllowed } from "@/lib/crawl/robots";

export const CRAWLER_USER_AGENT = DEFAULT_CRAWLER_USER_AGENT;

/** No robots.txt at all means no restriction — RFC 9309's own default. */
export function isCrawlAllowed(
  robotsBody: string | null,
  path: string,
): boolean {
  if (!robotsBody) return true;
  return isAllowed(robotsBody, CRAWLER_USER_AGENT, path).allowed;
}

const JS_SHELL_MARKERS: RegExp[] = [
  /<div\s+id=["']root["']\s*>\s*<\/div>/i,
  /<div\s+id=["']__next["']\s*>\s*<\/div>/i,
  /<div\s+id=["']app["']\s*>\s*<\/div>/i,
  /you need to enable javascript/i,
  /please enable javascript/i,
];

/**
 * A v1 heuristic, not a real JS-execution check: either the page contains a
 * known client-side-framework mount point with nothing rendered into it, or
 * the HTML is substantial but the extracted text is suspiciously thin —
 * both suggest the real content only exists after client-side rendering.
 * Feeds the STATIC → BROWSER render-mode decision; false positives just
 * cost one extra (and currently best-effort — see
 * src/lib/providers/browser/client.ts) render, so this errs toward
 * over-flagging rather than under-flagging.
 */
export function needsBrowserRender(html: string, wordCount: number): boolean {
  if (JS_SHELL_MARKERS.some((pattern) => pattern.test(html))) return true;
  if (html.length > 2000 && wordCount < 40) return true;
  return false;
}
