import { getDomain, getSubdomain } from "tldts";

/**
 * The registrable domain (eTLD+1) for a URL or bare hostname — e.g.
 * "shop.example.co.uk" -> "example.co.uk". Naive hostname parsing (strip
 * "www.", keep the rest) cannot handle multi-part public suffixes, and
 * without this, two subdomains of the same company look like two different
 * companies wherever domain identity matters:
 * - Brand.domain / Competitor.domain uniqueness (this module, Phase 1a)
 * - SERP-discovered competitor aggregation (Phase 3), which is exactly
 *   "collapse the same registrable domain across many result rows"
 *
 * `allowPrivateDomains` is deliberately on: without it, a competitor hosted
 * on a PSL "private" suffix (mycompany.github.io, mycompany.blogspot.com)
 * would collapse to the platform's own domain (github.io) and get merged
 * with every other unrelated company on that platform.
 */
export function registrableDomain(input: string): string {
  const domain = getDomain(input, { allowPrivateDomains: true });
  return domain?.toLowerCase() ?? "";
}

/** The label(s) below the registrable domain, e.g. "shop" for "shop.example.co.uk". Null if there is none. */
export function subdomain(input: string): string | null {
  const sub = getSubdomain(input, { allowPrivateDomains: true });
  return sub ? sub.toLowerCase() : null;
}
