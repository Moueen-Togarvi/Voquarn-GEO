"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, ListChecks, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Building2 },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bg-card flex flex-col gap-1 p-3"
      data-testid="dashboard-sidebar"
    >
      <Link
        href="/dashboard"
        className="mb-4 flex items-center gap-2 px-2 py-1 text-lg font-semibold tracking-tight"
      >
        <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-sm font-bold">
          V
        </span>
        Voquarn
      </Link>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        // "/dashboard" must match exactly; others match as a path prefix so
        // e.g. /brands/123 keeps "Brands" highlighted.
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
