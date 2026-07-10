"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RunStatus } from "@/lib/design-tokens";
import { runStatusConfig } from "@/lib/design-tokens";

interface StatusBadgeProps {
  status: RunStatus;
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "md",
  pulse,
  className,
}: StatusBadgeProps) {
  const config = runStatusConfig[status];
  const shouldPulse = pulse ?? (status === "running" || status === "paused");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className
      )}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
      }}
    >
      <span
        className={cn(
          "inline-block rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          shouldPulse && "animate-pulse"
        )}
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}

interface CyanBadgeProps {
  children: ReactNode;
  className?: string;
}

export function CyanBadge({ children, className }: CyanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium",
        "text-[var(--cyan)] bg-[var(--cyan-subtle)] border border-[var(--cyan)]/20",
        className
      )}
    >
      {children}
    </span>
  );
}
