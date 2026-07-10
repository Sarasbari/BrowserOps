"use client";

import React, { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "heavy" | "light";
  glow?: "none" | "gold" | "cyan";
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  variant = "default",
  glow = "none",
  hover = true,
  onClick,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !hover) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    };

    card.addEventListener("mousemove", handleMouseMove);
    return () => card.removeEventListener("mousemove", handleMouseMove);
  }, [hover]);

  const variantClass = {
    default: "glass",
    heavy: "glass-heavy",
    light: "glass-light",
  }[variant];

  const glowClass = {
    none: "",
    gold: "glow-gold-border",
    cyan: "glow-cyan-border",
  }[glow];

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={cn(
        variantClass,
        glowClass,
        "rounded-xl relative overflow-hidden",
        "transition-all duration-300 ease-out",
        hover && "hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-xl cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Mouse-tracking highlight */}
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.04), transparent 40%)",
          }}
        />
      )}
      {children}
    </div>
  );
}
