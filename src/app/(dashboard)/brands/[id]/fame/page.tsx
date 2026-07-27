import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FameCenter } from "@/components/fame-center";

export const dynamic = "force-dynamic";

export default async function BrandFamePage({
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

  return <FameCenter brandId={id} />;
}
