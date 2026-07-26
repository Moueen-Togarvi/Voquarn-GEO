import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

// Full brand management (list, add dialog, prompt generation) lands in Phase 1.6.
export default function BrandsPage() {
  return (
    <div>
      <PageHeader
        title="Brands"
        description="The brands you're monitoring across AI engines."
      />
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          Brand management is coming in a later step.
        </CardContent>
      </Card>
    </div>
  );
}
