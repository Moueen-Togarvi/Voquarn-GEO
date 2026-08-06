import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { fetchPinned } from "@/lib/net/pinned-agent";
import { isPrivateAddress } from "@/lib/net/ip";

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_LENGTH = 12_000;
const REQUEST_TIMEOUT_MS = 15_000;

export type WebsiteSnapshot = {
  finalUrl: string;
  title: string | null;
  description: string | null;
  text: string;
};

export class UnsafeWebsiteError extends Error {}

/**
 * Validates `value` and returns the specific IP address that was checked and
 * found public, so the caller can pin the actual HTTP connection to it — see
 * src/lib/net/pinned-agent.ts. Without pinning, fetch() would re-resolve DNS
 * independently after this check, and an attacker controlling the DNS
 * response could rebind the hostname to a private address in between.
 *
 * Return contract, unchanged from before: `{ address }` = verified public,
 * `null` = DNS lookup failed (soft-fail — the model's web search can still
 * discover the brand without a direct website snapshot), throws
 * UnsafeWebsiteError = definitively unsafe.
 */
export async function assertPublicWebsiteUrl(
  value: string,
): Promise<{ address: string } | null> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeWebsiteError("Website URL must use http or https.");
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new UnsafeWebsiteError("Use a public company website URL.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeWebsiteError("Use a public company website URL.");
    }
    return { address: hostname };
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateAddress(address))
    ) {
      throw new UnsafeWebsiteError("Use a public company website URL.");
    }
    return { address: addresses[0].address };
  } catch (error) {
    if (error instanceof UnsafeWebsiteError) throw error;
    return null;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function matchMeta(html: string, key: "description" | "og:description") {
  const escaped = key.replace(":", "\\:");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value).replace(/\s+/g, " ").trim();
  }
  return null;
}

export function extractWebsiteSnapshot(
  html: string,
  finalUrl: string,
): WebsiteSnapshot {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  return {
    finalUrl,
    title: titleMatch
      ? decodeHtml(titleMatch).replace(/\s+/g, " ").trim().slice(0, 200)
      : null,
    description:
      matchMeta(html, "description") ?? matchMeta(html, "og:description"),
    text,
  };
}

type FetchOutcome =
  | { kind: "redirect"; location: string }
  | { kind: "snapshot"; snapshot: WebsiteSnapshot }
  | { kind: "abort" };

export async function readPublicWebsite(
  websiteUrl: string,
): Promise<WebsiteSnapshot | null> {
  let currentUrl = websiteUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    // Re-validated and re-pinned on every hop: a redirect can point anywhere,
    // including back into a private network.
    const validated = await assertPublicWebsiteUrl(currentUrl);
    if (!validated) return null;

    const hopUrl = currentUrl;
    let outcome: FetchOutcome;
    try {
      outcome = await fetchPinned(
        hopUrl,
        validated.address,
        {
          redirect: "manual",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Voquarn-GEO/1.0 (+brand research; contact the site owner for access questions)",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
        async (response): Promise<FetchOutcome> => {
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) return { kind: "abort" };
            return {
              kind: "redirect",
              location: new URL(location, hopUrl).toString(),
            };
          }

          if (!response.ok) return { kind: "abort" };

          const contentType = response.headers
            .get("content-type")
            ?.toLowerCase();
          if (contentType && !contentType.includes("text/html")) {
            return { kind: "abort" };
          }

          const contentLength = Number(response.headers.get("content-length"));
          if (
            Number.isFinite(contentLength) &&
            contentLength > MAX_HTML_BYTES
          ) {
            return { kind: "abort" };
          }

          const html = (await response.text()).slice(0, MAX_HTML_BYTES);
          return {
            kind: "snapshot",
            snapshot: extractWebsiteSnapshot(html, hopUrl),
          };
        },
      );
    } catch {
      return null;
    }

    if (outcome.kind === "abort") return null;
    if (outcome.kind === "snapshot") return outcome.snapshot;
    if (redirect === MAX_REDIRECTS) return null;
    currentUrl = outcome.location;
  }

  return null;
}
