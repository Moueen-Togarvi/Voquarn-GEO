import Link from "next/link";
import { Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUserBrands } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { AddBrandDialog } from "@/components/add-brand-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Server component — always render fresh so a newly-added brand shows up.
export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const user = await getCurrentUser();
  const brands = user ? await getUserBrands(user.id) : [];

  return (
    <div>
      <PageHeader
        title="Brands"
        description="The brands you're monitoring across AI engines."
      >
        <AddBrandDialog />
      </PageHeader>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted grid size-12 place-items-center rounded-full">
              <Building2 className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No brands yet</p>
              <p className="text-muted-foreground text-sm">
                Add your first brand to start tracking its AI visibility.
              </p>
            </div>
            <AddBrandDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{brand.name}</span>
                  {brand.latestScore !== null ? (
                    <Badge variant="secondary">{brand.latestScore}</Badge>
                  ) : null}
                </CardTitle>
                <p className="text-muted-foreground truncate text-sm">
                  {brand.domain}
                </p>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {brand.latestScore !== null
                    ? "Latest visibility"
                    : "Not scanned yet"}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/brands/${brand.id}`}>View</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
