import type { KeywordIntent } from "@/generated/prisma/enums";

/**
 * A v1 keyword-hint heuristic, not a trained classifier — deliberately
 * simple and easy to audit. Reuses KeywordIntent (the same enum tracked
 * keywords use) rather than a parallel PageIntent enum, since a page's
 * classified intent is exactly what Phase 5's gap detectors compare against
 * a keyword's own intent.
 */
export type IntentSignal = {
  url: string;
  title: string | null;
  headings: string[];
};

const NAVIGATIONAL_HINTS = [
  "login",
  "sign-in",
  "signin",
  "account",
  "dashboard",
  "contact",
  "about",
  "careers",
];

const TRANSACTIONAL_HINTS = [
  "buy",
  "signup",
  "sign-up",
  "sign up",
  "free trial",
  "start trial",
  "book a demo",
  "request a demo",
  "purchase",
  "checkout",
  "get started",
  "download",
];

const COMMERCIAL_HINTS = [
  "pricing",
  "price",
  "plans",
  " vs ",
  " vs. ",
  "compare",
  "comparison",
  "alternative",
  "review",
  "best ",
  "top ",
];

function matchesAny(haystack: string, hints: string[]): boolean {
  return hints.some((hint) => haystack.includes(hint));
}

export function classifyIntent(signal: IntentSignal): KeywordIntent {
  const haystack = ` ${[signal.url, signal.title ?? "", ...signal.headings]
    .join(" ")
    .toLowerCase()} `;

  if (matchesAny(haystack, NAVIGATIONAL_HINTS)) return "NAVIGATIONAL";
  if (matchesAny(haystack, TRANSACTIONAL_HINTS)) return "TRANSACTIONAL";
  if (matchesAny(haystack, COMMERCIAL_HINTS)) return "COMMERCIAL";
  return "INFORMATIONAL";
}
