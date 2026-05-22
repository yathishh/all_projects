import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, ArrowRightLeft, Database,
  Grid3X3, ArchiveRestore, HardDrive, ScrollText, Bell,
  Plug, ChevronLeft, ChevronRight, Zap, Settings, Activity, RefreshCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { path: "/", icon: LayoutDashboard, label: "Dashboard" },
      { path: "/activity", icon: Activity, label: "Activity Log" },
    ],
  },
  {
    label: "Migration",
    items: [
      { path: "/projects", icon: FolderKanban, label: "Projects" },
      { path: "/new-migration", icon: ArrowRightLeft, label: "New Migration" },
      { path: "/compatibility", icon: Grid3X3, label: "Compatibility" },
    ],
  },
  {
    label: "Backup & Restore",
    items: [
      { path: "/backups", icon: ArchiveRestore, label: "Backup Jobs" },
      { path: "/restore", icon: RefreshCcw, label: "Restore Jobs" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { path: "/storage", icon: HardDrive, label: "Storage Engines" },
      { path: "/connections", icon: Plug, label: "Connections" },
      { path: "/databases", icon: Database, label: "Databases" },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/alerts", icon: Bell, label: "Alerts" },
      { path: "/audit", icon: ScrollText, label: "Audit Trail" },
      { path: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export default function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm tracking-tight truncate">DBMigrate Pro</h1>
              <p className="text-[9px] text-muted-foreground truncate uppercase tracking-widest">Enterprise</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              {!collapsed && (
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 py-1.5">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="h-2" />}
              {section.items.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(item.path));
                return (
                  <Link key={item.path} to={item.path}>
                    <div className={cn(
                      "flex items-center gap-2.5 mx-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate text-xs">{item.label}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Version + Collapse */}
        <div className="p-2 border-t border-border shrink-0 space-y-1">
          {!collapsed && (
            <p className="text-[9px] text-muted-foreground/50 text-center font-mono">v2.0.0 • Open Source</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center h-7"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}