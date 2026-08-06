import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PromptTable } from "@/components/prompt-table";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";

export const metadata = { title: "Prompts" };

export default async function PromptsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Measurement"
        title="Prompts"
        description="The buyer questions that determine where your brand appears in AI answers."
      />
      <div className="content-card">
        <PromptTable brandId={brand.id} />
      </div>
    </div>
  );
}
