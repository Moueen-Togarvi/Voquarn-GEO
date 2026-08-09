import { notFound } from "next/navigation";
import { ProjectNavigation } from "@/components/project-navigation";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { isAuthEnabled } from "@/lib/auth/flag";
import { getBrand, listBrands, listDraftBrands } from "@/lib/brands/service";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const [current, projects, drafts] = await Promise.all([
    getBrand(ctx, brandId),
    listBrands(ctx),
    listDraftBrands(ctx),
  ]);
  if (!current) notFound();

  return (
    <div className="app-shell">
      <ProjectNavigation
        current={current}
        projects={projects}
        drafts={drafts}
        authEnabled={isAuthEnabled()}
      />
      <main className="project-main">{children}</main>
    </div>
  );
}
