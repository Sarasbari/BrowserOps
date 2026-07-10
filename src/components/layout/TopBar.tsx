"use client";

import React from "react";
import { UserButton } from "@clerk/nextjs";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 border-b border-[var(--obsidian-border)] glass-heavy">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
            "bg-[var(--obsidian-surface)] text-[var(--text-muted)]",
            "border border-[var(--obsidian-border)]",
            "hover:border-[var(--gold)]/30 hover:text-[var(--text-secondary)]",
            "transition-all duration-200"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline text-xs">Search...</span>
          <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--obsidian-elevated)] text-[var(--text-muted)] border border-[var(--obsidian-border)]">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className={cn(
            "relative p-2 rounded-lg",
            "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            "hover:bg-[var(--obsidian-elevated)]",
            "transition-all duration-200"
          )}
        >
          <Bell className="h-4 w-4" />
          {/* HITL notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
        </button>

        {/* User */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8 ring-2 ring-[var(--obsidian-border)] hover:ring-[var(--gold)]/30 transition-all",
            },
          }}
        />
      </div>
    </header>
  );
}
