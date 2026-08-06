import { OnboardingShell } from "@/components/onboarding-shell";
import { CRAWLER_USER_AGENT } from "@/lib/crawl/policy";
import { AI_CRAWLER_BOTS } from "@/lib/geo/ai-crawler-audit";

export const metadata = { title: "Voquarn crawler" };

const CRAWLER_PRODUCT_TOKEN = CRAWLER_USER_AGENT.split("/")[0];

export default function CrawlerPage() {
  return (
    <OnboardingShell
      eyebrow="Crawler identity"
      title="How Voquarn's crawler works"
      lead="Voquarn periodically fetches pages from sites our customers track — their own site, and up to a handful of tracked competitors — to measure content coverage, structured data, and freshness for our GEO reports."
    >
      <section className="form-section">
        <div className="form-section-heading">
          <div>
            <h2>Identify us</h2>
            <p>Every request we make carries this exact User-Agent string.</p>
          </div>
        </div>
        <pre className="crawler-ua">{CRAWLER_USER_AGENT}</pre>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <div>
            <h2>What we do</h2>
          </div>
        </div>
        <ul className="crawler-list">
          <li>
            We only fetch pages a site already publishes publicly — no login, no
            private areas.
          </li>
          <li>
            We check and respect your robots.txt for our own user-agent on every
            request.
          </li>
          <li>
            We fetch a bounded sample of pages per crawl, not your entire site.
          </li>
          <li>
            We only ever make read requests (HTTP GET) — never anything that
            changes state on your site.
          </li>
        </ul>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <div>
            <h2>Opt out</h2>
            <p>Add this to your robots.txt to block us entirely.</p>
          </div>
        </div>
        <pre className="crawler-ua">{`User-agent: ${CRAWLER_PRODUCT_TOKEN}\nDisallow: /`}</pre>
        <p className="muted-text">
          Questions or concerns about this crawler? Contact us at the address in
          the User-Agent string above.
        </p>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <div>
            <h2>AI crawlers we audit access for</h2>
            <p>
              We also check (never impersonate) whether the crawlers that feed
              AI answer engines can reach your site — a common, accidental block
              is one of the most defensible findings a GEO report can surface.
            </p>
          </div>
        </div>
        <ul className="crawler-list crawler-list-columns">
          {AI_CRAWLER_BOTS.map((bot) => (
            <li key={bot}>{bot}</li>
          ))}
        </ul>
      </section>
    </OnboardingShell>
  );
}
