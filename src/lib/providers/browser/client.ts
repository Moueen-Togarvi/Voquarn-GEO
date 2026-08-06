export type BrowserRenderResult = {
  html: string;
  finalUrl: string;
};

const DEFAULT_ENDPOINT = "https://chrome.browserless.io";

/**
 * A managed headless-browser renderer (Browserless), for the pages
 * src/lib/crawl/policy.ts's needsBrowserRender() flags as client-rendered.
 * Structurally complete against Browserless's documented `/content` REST
 * endpoint but never exercised against a live instance in this environment
 * (no API key available here) — verify before relying on it in production,
 * same caveat as every other external provider client built this session.
 *
 * Deliberately never run in-process (no Playwright/Puppeteer dependency
 * here) — see CLAUDE.md-adjacent guidance in the implementation plan:
 * "Never run Playwright inside a request handler or a Vercel function."
 * The actual browser runs on Browserless's infrastructure; this is just an
 * HTTP client.
 */
export class BrowserRenderClient {
  constructor(
    private readonly apiKey = process.env.BROWSERLESS_API_KEY,
    private readonly endpoint = process.env.BROWSERLESS_ENDPOINT ??
      DEFAULT_ENDPOINT,
  ) {}

  async render(
    url: string,
    options: { timeoutMs?: number } = {},
  ): Promise<BrowserRenderResult> {
    if (!this.apiKey) {
      throw new Error(
        "BROWSERLESS_API_KEY is not configured. Browser rendering is disabled until it is provided.",
      );
    }

    const endpoint = `${this.endpoint.replace(/\/$/, "")}/content?token=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle2" } }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new Error(`Browser render request failed (${response.status}).`);
    }

    const html = await response.text();
    return { html, finalUrl: url };
  }
}
