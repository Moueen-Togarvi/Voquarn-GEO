import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

// The Action Center (gap-driven to-do list) lands in Phase 2.5.
export default function ActionsPage() {
  return (
    <div>
      <PageHeader
        title="Actions"
        description="Optimization opportunities generated from your monitoring data."
      />
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          The Action Center is coming in a later step.
        </CardContent>
      </Card>
    </div>
  );
}
