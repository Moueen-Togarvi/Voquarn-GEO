import { currentUser } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await currentUser();
  const name = user?.firstName ?? "there";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Your GEO command center. Add a brand to start tracking how it shows up in AI answers."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Brands tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">0</p>
            <p className="text-muted-foreground text-xs">
              Add your first brand from the Brands page.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Latest scan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No scans yet.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Open actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Run a scan to surface optimization opportunities.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
