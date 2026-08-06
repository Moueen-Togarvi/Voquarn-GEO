import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brand-form";
import { DeleteProject } from "@/components/delete-project";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";

export const metadata = { title: "Project settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  return (
    <div className="page-container settings-page">
      <PageHeader
        eyebrow="Configuration"
        title="Project settings"
        description="Review the researched company profile or re-run discovery from the official website."
      />
      <BrandForm brand={brand} />
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
