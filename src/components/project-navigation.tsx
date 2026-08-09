"use client";

import {
  BarChart3,
  Bot,
  CalendarCheck,
  ChevronDown,
  FileEdit,
  FileQuestion,
  FileText,
  Globe2,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { signOut } from "@/lib/auth/client";
import type { BrandDto } from "@/lib/brands/types";
import { cn, initials } from "@/lib/utils";

const navItems = [
  { label: "Overview", slug: "overview", icon: BarChart3, next: false },
  { label: "Prompts", slug: "prompts", icon: FileQuestion, next: false },
  { label: "Runs", slug: "runs", icon: TrendingUp, next: false },
  { label: "Competitors", slug: "competitors", icon: ShieldAlert, next: false },
  { label: "Pages", slug: "pages", icon: FileText, next: false },
  { label: "Opportunities", slug: "opportunities", icon: Target, next: false },
  { label: "Plan", slug: "plan", icon: CalendarCheck, next: false },
  { label: "Content", slug: "content", icon: FileEdit, next: false },
  { label: "Sources", slug: "sources", icon: Globe2, next: false },
  { label: "Models", slug: "models", icon: Bot, next: true },
] as const;

function ProjectSwitcher({
  current,
  projects,
  drafts,
  closeNavigation,
}: {
  current: BrandDto;
  projects: BrandDto[];
  drafts: BrandDto[];
  closeNavigation?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function rememberProject(projectId: string) {
    void projectId;
    setOpen(false);
    closeNavigation?.();
  }

  return (
    <div className="project-switcher" ref={wrapperRef}>
      <button
        className="project-switcher-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="project-avatar">{initials(current.name)}</span>
        <span className="project-switcher-copy">
          <strong>{current.name}</strong>
          <small>{current.domain}</small>
        </span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="project-menu">
          <span className="menu-label">Projects</span>
          {projects.map((project) => (
            <Link
              className={cn(
                "project-menu-item",
                project.id === current.id && "is-current",
              )}
              href={`/projects/${project.id}/overview`}
              key={project.id}
              onClick={() => rememberProject(project.id)}
            >
              <span className="project-avatar small">
                {initials(project.name)}
              </span>
              <span>
                <strong>{project.name}</strong>
                <small>{project.domain}</small>
              </span>
            </Link>
          ))}
          {drafts.length > 0 ? (
            <>
              <span className="menu-label">Drafts</span>
              {drafts.map((draft) => (
                <Link
                  className="project-menu-item is-draft"
                  href={`/onboarding/review/${draft.id}`}
                  key={draft.id}
                  onClick={closeNavigation}
                >
                  <span className="project-avatar small">
                    {initials(draft.name)}
                  </span>
                  <span>
                    <strong>
                      {draft.name} <span className="count-pill">Draft</span>
                    </strong>
                    <small>Finish onboarding to activate</small>
                  </span>
                </Link>
              ))}
            </>
          ) : null}
          <Link
            className="project-menu-add"
            href="/onboarding"
            onClick={closeNavigation}
          >
            <Plus size={15} /> Add project
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NavigationContent({
  current,
  projects,
  drafts,
  close,
  authEnabled,
}: {
  current: BrandDto;
  projects: BrandDto[];
  drafts: BrandDto[];
  close?: () => void;
  authEnabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <>
      <div className="sidebar-top">
        <Link className="brand-lockup sidebar-brand" href="/" onClick={close}>
          <span className="brand-mark">V</span>
          <span>
            Voquarn <strong>GEO</strong>
          </span>
        </Link>
        {close ? (
          <button
            className="icon-button mobile-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        ) : null}
      </div>

      {authEnabled ? <WorkspaceSwitcher /> : null}

      <ProjectSwitcher
        current={current}
        projects={projects}
        drafts={drafts}
        closeNavigation={close}
      />

      <nav className="sidebar-nav" aria-label="Project navigation">
        <span className="nav-section-label">Workspace</span>
        {navItems.map((item) => {
          const href = `/projects/${current.id}/${item.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              className={cn("nav-item", active && "is-active")}
              href={href}
              key={item.slug}
              onClick={close}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.next ? <small>Next</small> : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <Link
          className={cn(
            "nav-item",
            pathname.endsWith("/settings") && "is-active",
          )}
          href={`/projects/${current.id}/settings`}
          onClick={close}
        >
          <Settings size={18} />
          <span>Project settings</span>
        </Link>
        {authEnabled ? (
          <Link
            className={cn(
              "nav-item",
              pathname === "/settings/members" && "is-active",
            )}
            href="/settings/members"
            onClick={close}
          >
            <Users size={18} />
            <span>Members</span>
          </Link>
        ) : null}
        {authEnabled ? (
          <button className="nav-item" type="button" onClick={handleSignOut}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        ) : null}
        <div className="phase-card">
          <span>Phase 6</span>
          <strong>AUTO-BUILD</strong>
          <p>Deploy + monitor is the next milestone.</p>
        </div>
      </div>
    </>
  );
}

export function ProjectNavigation({
  current,
  projects,
  drafts = [],
  authEnabled = false,
}: {
  current: BrandDto;
  projects: BrandDto[];
  /** Unfinished onboarding — see src/lib/brands/service.ts's listDraftBrands(). */
  drafts?: BrandDto[];
  /** See src/lib/auth/flag.ts — off hides Members/sign-out/workspace switching, which have nothing to act on yet. */
  authEnabled?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.cookie = `voquarn_project=${current.id}; path=/; max-age=31536000; samesite=lax`;
  }, [current.id]);

  return (
    <>
      <aside className="sidebar desktop-sidebar">
        <NavigationContent
          current={current}
          projects={projects}
          drafts={drafts}
          authEnabled={authEnabled}
        />
      </aside>

      <header className="mobile-header">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">V</span>
          <span>
            Voquarn <strong>GEO</strong>
          </span>
        </Link>
        <button
          className="icon-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
      </header>

      {mobileOpen ? (
        <div className="mobile-drawer-layer">
          <button
            className="drawer-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="sidebar mobile-sidebar">
            <NavigationContent
              current={current}
              projects={projects}
              drafts={drafts}
              close={() => setMobileOpen(false)}
              authEnabled={authEnabled}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
