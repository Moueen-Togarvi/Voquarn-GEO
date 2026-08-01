import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 192 && second === 0 && parts[2] === 2) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicWebsiteUrl(value: string) {
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
    return true;
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateAddress(address))
    ) {
      throw new UnsafeWebsiteError("Use a public company website URL.");
    }
    return true;
  } catch (error) {
    if (error instanceof UnsafeWebsiteError) throw error;
    // DNS can be unavailable transiently. The model's web search can still
    // discover the brand without a direct website snapshot.
    return false;
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

export async function readPublicWebsite(
  websiteUrl: string,
): Promise<WebsiteSnapshot | null> {
  let currentUrl = websiteUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!(await assertPublicWebsiteUrl(currentUrl))) return null;

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Voquarn-GEO/1.0 (+brand research; contact the site owner for access questions)",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) return null;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase();
    if (contentType && !contentType.includes("text/html")) return null;

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      return null;
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return extractWebsiteSnapshot(html, currentUrl);
  }

  return null;
}
