import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBrandDashboard } from "@/lib/dashboard";
import { BrandDashboardView } from "@/components/brand-dashboard";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const data = await getBrandDashboard(id, user.id);
  if (!data) notFound();

  return <BrandDashboardView data={data} />;
}
