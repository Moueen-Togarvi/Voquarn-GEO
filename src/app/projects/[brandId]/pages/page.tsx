import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RunCrawlButton } from "@/components/run-crawl-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import {
  getLatestCrawlRun,
  listPageSnapshotsForCrawlRun,
} from "@/lib/crawl/service";

export const metadata = { title: "Pages" };

function pathOf(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname || "/";
  } catch {
    return url;
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function PagesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const latestRun = await getLatestCrawlRun(ctx, { brandId: brand.id });
  const snapshots = latestRun
    ? await listPageSnapshotsForCrawlRun(ctx, latestRun.id)
    : [];

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Autopsy"
        title="Pages"
        description="A crawl of your own site — content, structured data, and freshness for each page."
        action={<RunCrawlButton endpoint={`/api/brands/${brand.id}/crawl`} />}
      />

      {!latestRun ? (
        <p className="muted-text">
          No crawl yet. Run one above to see your pages.
        </p>
      ) : (
        <div className="content-card">
          <div className="card-heading">
            <h2>
              {snapshots.length} page{snapshots.length === 1 ? "" : "s"} crawled
            </h2>
            <small className="status-pill">{latestRun.status}</small>
          </div>
          {snapshots.length === 0 ? (
            <p className="muted-text">
              The crawl finished but no pages were fetched — check that your
              site has a reachable sitemap.
            </p>
          ) : (
            <div className="run-table-wrap">
              <table className="run-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Title</th>
                    <th>Words</th>
                    <th>Intent</th>
                    <th>Freshness</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td>
                        <a href={snapshot.url} target="_blank" rel="noreferrer">
                          {pathOf(snapshot.url)}
                        </a>
                      </td>
                      <td>{snapshot.observation?.title ?? "—"}</td>
                      <td>{snapshot.observation?.wordCount ?? "—"}</td>
                      <td>{snapshot.observation?.intent ?? "—"}</td>
                      <td>
                        {snapshot.observation
                          ? formatPercent(
                              snapshot.observation.freshnessConfidence,
                            )
                          : "—"}
                      </td>
                      <td>{snapshot.httpStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
