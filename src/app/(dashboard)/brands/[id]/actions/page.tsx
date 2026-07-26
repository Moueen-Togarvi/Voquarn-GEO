import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ActionCenter } from "@/components/action-center";

export const dynamic = "force-dynamic";

export default async function BrandActionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const brand = await db.brand.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!brand || brand.userId !== user.id) notFound();

  return <ActionCenter brandId={id} />;
}
