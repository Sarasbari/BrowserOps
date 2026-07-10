"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GitBranch,
  Play,
  Clock,
  KeyRound,
  Settings,
  ChevronLeft,
  Bot,
  Zap,
} from "lucide-react";

const navItems = [
  {
    label: "Command Center",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: GitBranch,
  },
  {
    label: "Runs",
    href: "/runs",
    icon: Play,
  },
  {
    label: "Schedules",
    href: "/schedules",
    icon: Clock,
  },
  {
    label: "Credentials",
    href: "/credentials",
    icon: KeyRound,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col",
        "glass-heavy border-r border-[var(--obsidian-border)]",
        "transition-all duration-300 ease-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--obsidian-border)]">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dim)]">
          <Bot className="h-5 w-5 text-[var(--obsidian)]" />
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--cyan)] border-2 border-[var(--obsidian)]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gradient-gold">
              BrowserOps
            </span>
            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-[var(--cyan)]" />
              Resilient Automation
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-[var(--gold-subtle)] text-[var(--gold)] font-medium shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)]"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] flex-shrink-0",
                  isActive ? "text-[var(--gold)]" : "text-[var(--text-muted)]"
                )}
              />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-[var(--obsidian-border)]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs",
            "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)]",
            "transition-all duration-200"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
