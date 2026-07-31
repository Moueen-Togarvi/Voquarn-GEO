"use client";

import {
  BarChart3,
  Bot,
  ChevronDown,
  FileQuestion,
  Globe2,
  Menu,
  Plus,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BrandDto } from "@/lib/brands/types";
import { cn, initials } from "@/lib/utils";

const navItems = [
  { label: "Overview", slug: "overview", icon: BarChart3, next: false },
  { label: "Prompts", slug: "prompts", icon: FileQuestion, next: true },
  { label: "Sources", slug: "sources", icon: Globe2, next: true },
  { label: "Models", slug: "models", icon: Bot, next: true },
] as const;

function ProjectSwitcher({
  current,
  projects,
  closeNavigation,
}: {
  current: BrandDto;
  projects: BrandDto[];
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
  close,
}: {
  current: BrandDto;
  projects: BrandDto[];
  close?: () => void;
}) {
  const pathname = usePathname();

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

      <ProjectSwitcher
        current={current}
        projects={projects}
        closeNavigation={close}
      />

      <nav className="sidebar-nav" aria-label="Project navigation">
        <span className="nav-section-label">Workspace</span>
        {navItems.map((item) => {
          const href = `/projects/${current.id}/${item.slug}`;
          const active = pathname === href;
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
        <div className="phase-card">
          <span>Phase 1</span>
          <strong>Foundation ready</strong>
          <p>Prompt tracking is the next milestone.</p>
        </div>
      </div>
    </>
  );
}

export function ProjectNavigation({
  current,
  projects,
}: {
  current: BrandDto;
  projects: BrandDto[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.cookie = `voquarn_project=${current.id}; path=/; max-age=31536000; samesite=lax`;
  }, [current.id]);

  return (
    <>
      <aside className="sidebar desktop-sidebar">
        <NavigationContent current={current} projects={projects} />
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
              close={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
