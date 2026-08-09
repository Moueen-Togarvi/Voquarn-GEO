import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listBrands, listDraftBrands } from "@/lib/brands/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ctx = await requireWorkspaceContext();
  const [brands, cookieStore] = await Promise.all([listBrands(ctx), cookies()]);

  if (brands.length === 0) {
    // Zero ACTIVE projects doesn't mean zero projects — an unfinished DRAFT
    // must resume onboarding, not restart it as if nothing existed.
    const drafts = await listDraftBrands(ctx);
    if (drafts.length > 0) {
      redirect(`/onboarding/review/${drafts[0].id}`);
    }
    redirect("/onboarding");
  }

  const preferredId = cookieStore.get("voquarn_project")?.value;
  const preferred =
    brands.find((brand) => brand.id === preferredId) ?? brands[0];
  redirect(`/projects/${preferred.id}/overview`);
}
