import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUserBrands } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Global Actions entry: the real Action Center is per-brand
 * (/brands/[id]/actions). With one brand we jump straight there; otherwise we
 * show a picker.
 */
export default async function ActionsPage() {
  const user = await getCurrentUser();
  const brands = user ? await getUserBrands(user.id) : [];

  if (brands.length === 1) {
    redirect(`/brands/${brands[0].id}/actions`);
  }

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Pick a brand to open its Action Center."
      />

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted grid size-12 place-items-center rounded-full">
              <Building2 className="text-muted-foreground size-6" />
            </div>
            <p className="text-muted-foreground text-sm">
              Add a brand first, then run a scan to surface optimization
              actions.
            </p>
            <Button asChild>
              <Link href="/brands">Go to Brands</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{brand.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {brand.domain}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/brands/${brand.id}/actions`}>
                    <ListChecks className="size-4" />
                    Actions
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
