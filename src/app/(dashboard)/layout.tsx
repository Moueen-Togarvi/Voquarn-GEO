import { UserButton } from "@clerk/nextjs";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { MobileNav } from "@/components/mobile-nav";

/**
 * Protected dashboard shell. Auth is enforced in middleware; this layout only
 * lays out the chrome: a persistent sidebar (md+) and a top bar.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh grid-cols-1 md:grid-cols-[16rem_1fr]">
      {/* Persistent sidebar on md+ screens. */}
      <aside className="border-border hidden border-r md:block">
        <div className="sticky top-0 h-svh overflow-y-auto">
          <DashboardSidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur">
          <MobileNav />
          <div className="flex-1" />
          <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
