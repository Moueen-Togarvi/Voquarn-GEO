import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// The full monitoring dashboard (scan button, gauges, charts, prompts table)
// is built in Phase 1.7. This stub verifies ownership and shows basic info.
export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const brand = await db.brand.findUnique({
    where: { id },
    include: { _count: { select: { prompts: true, competitors: true } } },
  });
  if (!brand || brand.userId !== user.id) notFound();

  return (
    <div>
      <PageHeader title={brand.name} description={brand.domain} />
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          {brand._count.prompts} prompts · {brand._count.competitors}{" "}
          competitors. The monitoring dashboard is coming next.
        </CardContent>
      </Card>
    </div>
  );
}
