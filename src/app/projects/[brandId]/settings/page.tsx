import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brand-form";
import { DeleteProject } from "@/components/delete-project";
import { DisconnectIntegrationButton } from "@/components/disconnect-integration-button";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getConnectionForSite } from "@/lib/integrations/service";
import { getOrCreateSiteForBrand } from "@/lib/sites/service";

export const metadata = { title: "Project settings" };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ gsc?: string; gscMessage?: string }>;
}) {
  const { brandId } = await params;
  const { gsc, gscMessage } = await searchParams;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const site = await getOrCreateSiteForBrand(ctx, brand.id);
  const connection = await getConnectionForSite(
    ctx,
    site.id,
    "GOOGLE_SEARCH_CONSOLE",
  );
  const connected = connection?.status === "ACTIVE";

  return (
    <div className="page-container settings-page">
      <PageHeader
        eyebrow="Configuration"
        title="Project settings"
        description="Review the researched company profile or re-run discovery from the official website."
      />

      {gsc === "connected" ? (
        <div className="form-alert form-alert-success" role="status">
          Search Console connected.
        </div>
      ) : null}
      {gsc === "error" ? (
        <div className="form-alert" role="alert">
          Could not connect Search Console{gscMessage ? `: ${gscMessage}` : "."}
        </div>
      ) : null}

      <BrandForm brand={brand} />

      <section className="content-card">
        <div className="card-heading">
          <div>
            <p className="page-eyebrow">Integrations</p>
            <h2>Google Search Console</h2>
          </div>
        </div>
        {connected && connection ? (
          <>
            <p className="muted-text">
              Connected to {connection.externalAccountId}. Clicks, impressions,
              and position data import daily.
            </p>
            <DisconnectIntegrationButton connectionId={connection.id} />
          </>
        ) : (
          <>
            <p className="muted-text">
              Connect Search Console to import real clicks, impressions, and
              position data for {site.domain}.
            </p>
            <a
              className="button button-secondary compact-button"
              href={`/api/integrations/google-search-console/authorize?brandId=${brand.id}`}
            >
              Connect Search Console
            </a>
          </>
        )}
      </section>

      <section className="danger-zone">
        <div>
          <h2>Delete this project</h2>
          <p>
            Remove the project and every related Phase 1 record. This cannot be
            undone.
          </p>
        </div>
        <DeleteProject brandId={brand.id} brandName={brand.name} />
      </section>
    </div>
  );
}
