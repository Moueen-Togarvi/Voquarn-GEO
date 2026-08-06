import { z } from "zod";

import { registrableDomain } from "@/lib/domains/canonical";

// Users routinely type a bare domain ("example.com"). Treat a missing scheme as
// https so the URL checks below see something parseable. Anything that already
// carries a scheme (including non-web ones like mailto:) is left untouched so
// the protocol check can still reject it.
export function withProtocol(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

export function normalizeUrl(value: string): string {
  const url = parseUrl(value);

  if (!url) {
    return value.trim();
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  if (url.pathname === "/") {
    url.pathname = "";
  }

  return url.toString().replace(/\/$/, "");
}

export function domainFromUrl(value: string): string {
  const hostname = parseUrl(withProtocol(value))?.hostname;
  return hostname ? registrableDomain(hostname) : "";
}

const websiteUrlSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? withProtocol(value) : value),
    z
      .string()
      .trim()
      .min(1, "Website URL is required")
      .url("Enter a valid website URL"),
  )
  .refine((value) => {
    const protocol = parseUrl(value)?.protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Website URL must use http or https")
  .transform(normalizeUrl);

export const brandDiscoveryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name is required")
    .max(80, "Keep the brand name under 80 characters"),
  websiteUrl: websiteUrlSchema,
});

export const competitorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Competitor name is required")
    .max(80, "Keep competitor names under 80 characters"),
  websiteUrl: websiteUrlSchema,
});

export const brandInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Brand name is required")
      .max(80, "Keep the brand name under 80 characters"),
    websiteUrl: websiteUrlSchema,
    description: z
      .string()
      .trim()
      .min(10, "Describe what the product does in at least 10 characters")
      .max(240, "Keep the description under 240 characters"),
    category: z
      .string()
      .trim()
      .min(3, "Use a specific category")
      .max(100, "Keep the category under 100 characters"),
    competitors: z
      .array(competitorInputSchema)
      .min(2, "Add at least two competitors")
      .max(4, "You can track up to four competitors in Phase 1"),
  })
  .superRefine((value, context) => {
    const brandName = value.name.toLocaleLowerCase();
    const brandDomain = domainFromUrl(value.websiteUrl);
    const names = new Set<string>();
    const domains = new Set<string>();

    value.competitors.forEach((competitor, index) => {
      const name = competitor.name.toLocaleLowerCase();
      const domain = domainFromUrl(competitor.websiteUrl);

      if (name === brandName || domain === brandDomain) {
        context.addIssue({
          code: "custom",
          path: ["competitors", index],
          message: "A competitor cannot match the tracked brand",
        });
      }

      if (names.has(name)) {
        context.addIssue({
          code: "custom",
          path: ["competitors", index, "name"],
          message: "Competitor names must be unique",
        });
      }

      if (domains.has(domain)) {
        context.addIssue({
          code: "custom",
          path: ["competitors", index, "websiteUrl"],
          message: "Competitor websites must be unique",
        });
      }

      names.add(name);
      domains.add(domain);
    });
  });

export const deleteBrandSchema = z.object({
  confirmation: z.string().trim().min(1),
});

export type BrandInput = z.infer<typeof brandInputSchema>;
export type BrandDiscoveryInput = z.infer<typeof brandDiscoveryInputSchema>;
