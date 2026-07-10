"use client";

import React, { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export function GoldButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: GoldButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-300 ease-out relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  const variantClasses = {
    primary: cn(
      "bg-gradient-to-r from-[var(--gold-dim)] via-[var(--gold)] to-[var(--gold-light)]",
      "text-[var(--text-inverse)] font-semibold",
      "shadow-lg hover:shadow-[var(--shadow-gold)]",
      "hover:brightness-110 active:brightness-95"
    ),
    secondary: cn(
      "bg-transparent border border-[var(--gold)] text-[var(--gold)]",
      "hover:bg-[var(--gold-subtle)] hover:shadow-[var(--shadow-gold)]",
      "active:bg-[var(--gold-glow)]"
    ),
    ghost: cn(
      "bg-transparent text-[var(--text-secondary)]",
      "hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)]",
      "active:bg-[var(--obsidian-surface)]"
    ),
    danger: cn(
      "bg-gradient-to-r from-red-700 via-red-600 to-red-500",
      "text-white font-semibold",
      "shadow-lg hover:shadow-red-500/30",
      "hover:brightness-110 active:brightness-95"
    ),
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {/* Shimmer overlay for primary */}
      {variant === "primary" && (
        <span className="absolute inset-0 animate-shimmer pointer-events-none" />
      )}

      {loading ? (
        <span className="inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
