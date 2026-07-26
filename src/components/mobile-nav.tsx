"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

/**
 * Mobile navigation trigger — opens the sidebar in a slide-out Sheet.
 * Hidden on md+ screens where the persistent sidebar is shown instead.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {/* Close the sheet after a nav link is tapped. */}
        <div onClick={() => setOpen(false)}>
          <DashboardSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
