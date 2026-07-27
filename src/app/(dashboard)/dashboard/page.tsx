import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserBrands } from "@/lib/queries";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const clerk = await currentUser();
  const name = clerk?.firstName ?? "there";

  const user = await getCurrentUser();
  const brands = user ? await getUserBrands(user.id) : [];

  // First-run: no brands yet → send the user through onboarding.
  if (user && brands.length === 0) redirect("/onboarding");
  const openActions = user
    ? await db.gap.count({
        where: { addressed: false, brand: { userId: user.id } },
      })
    : 0;

  // The most recently scanned brand, for the "Latest scan" card.
  const latest = brands.find((b) => b.lastScanAt) ?? null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Your GEO command center. Add a brand to start tracking how it shows up in AI answers."
      >
        <Button asChild>
          <Link href="/brands">Manage brands</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Brands tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {brands.length}
            </p>
            <p className="text-muted-foreground text-xs">
              {brands.length === 0
                ? "Add your first brand from the Brands page."
                : "Across all your monitored brands."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Latest scan</CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <>
                <p className="text-lg font-semibold">
                  {latest.name}
                  {latest.latestScore !== null ? (
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      · {latest.latestScore}/100
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {latest.lastScanAt
                    ? new Date(latest.lastScanAt).toLocaleDateString()
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No scans yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Open actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{openActions}</p>
            <p className="text-muted-foreground text-xs">
              {openActions === 0
                ? "Run a scan and analyze gaps to surface actions."
                : "Unaddressed optimization gaps."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
