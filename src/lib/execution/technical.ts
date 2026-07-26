// Technical GEO assets — copy-paste-ready JSON-LD schema, llms.txt, and an
// IndexNow submit helper. Pure/deterministic except submitToIndexNow (network).

export interface TechnicalBrand {
  name: string;
  domain: string;
  industry: string;
  description?: string | null;
}

function siteUrl(domain: string): string {
  const clean = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${clean}`;
}

/** JSON-LD Organization schema for the brand's homepage. */
export function generateOrganizationSchema(brand: TechnicalBrand): string {
  const url = siteUrl(brand.domain);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url,
    description: brand.description ?? `${brand.name} — ${brand.industry}.`,
    logo: `${url}/logo.png`,
    sameAs: [] as string[],
  };
  return JSON.stringify(schema, null, 2);
}

/** JSON-LD SoftwareApplication schema (Product variant for software brands). */
export function generateProductSchema(brand: TechnicalBrand): string {
  const url = siteUrl(brand.domain);
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: brand.industry,
    operatingSystem: "Web",
    url,
    description: brand.description ?? `${brand.name} — ${brand.industry}.`,
    offers: {
      "@type": "Offer",
      // Left generic on purpose — clients fill in real pricing.
      price: "0",
      priceCurrency: "USD",
    },
  };
  return JSON.stringify(schema, null, 2);
}

export interface QAPair {
  question: string;
  answer: string;
}

/** JSON-LD FAQPage schema from Q&A pairs (shared with the content generator). */
export function generateFAQSchema(qaPairs: QAPair[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qaPairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
  return JSON.stringify(schema, null, 2);
}

/**
 * Recommended llms.txt content — a curated map of the site for AI crawlers.
 * Based on the llmstxt.org convention.
 */
export function generateLlmsTxt(brand: TechnicalBrand): string {
  const url = siteUrl(brand.domain);
  return [
    `# ${brand.name}`,
    "",
    `> ${brand.description ?? `${brand.name} is a ${brand.industry} product.`}`,
    "",
    "## Key pages",
    "",
    `- [Home](${url}): Overview of ${brand.name}.`,
    `- [Pricing](${url}/pricing): Plans and pricing.`,
    `- [Docs](${url}/docs): Product documentation.`,
    `- [Blog](${url}/blog): Guides and comparisons.`,
    "",
    "## About",
    "",
    `${brand.name} operates in the ${brand.industry} space. Replace the pages`,
    "above with your real URLs and add an FAQ or comparison section so AI",
    "assistants can cite accurate, structured information.",
    "",
  ].join("\n");
}

export interface IndexNowResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Ping IndexNow so Bing (and thus ChatGPT Search) re-crawls the given URLs.
 * Requires the caller to have hosted the key file at
 * https://{domain}/{key}.txt. `key` is an arbitrary 8-128 char hex string.
 */
export async function submitToIndexNow(
  domain: string,
  urls: string[],
  key: string,
): Promise<IndexNowResult> {
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? "Submitted to IndexNow."
        : `IndexNow returned ${res.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message:
        error instanceof Error ? error.message : "IndexNow request failed.",
    };
  }
}

export interface TechnicalAssets {
  organizationSchema: string;
  productSchema: string;
  llmsTxt: string;
}

/** All copy-paste technical assets for a brand. */
export function buildTechnicalAssets(brand: TechnicalBrand): TechnicalAssets {
  return {
    organizationSchema: generateOrganizationSchema(brand),
    productSchema: generateProductSchema(brand),
    llmsTxt: generateLlmsTxt(brand),
  };
}
