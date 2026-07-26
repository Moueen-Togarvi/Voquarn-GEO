import { currentUser } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// Billing / plan settings are added with the SaaS layer in Phase 3.
export default async function SettingsPage() {
  const user = await currentUser();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and workspace."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Email</Label>
            <p>{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Name</Label>
            <p>{user?.fullName ?? "—"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
