import { notFound } from "next/navigation";
import { ProjectNavigation } from "@/components/project-navigation";
import { getBrand, listBrands } from "@/lib/brands/service";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const [current, projects] = await Promise.all([
    getBrand(brandId),
    listBrands(),
  ]);
  if (!current) notFound();

  return (
    <div className="app-shell">
      <ProjectNavigation current={current} projects={projects} />
      <main className="project-main">{children}</main>
    </div>
  );
}
