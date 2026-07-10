"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CircularGaugeProps {
  value: number; // 0 - 100
  max?: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: "gold" | "cyan" | "success" | "warning" | "error";
  className?: string;
}

const colorMap = {
  gold: { stroke: "var(--gold)", glow: "var(--gold-glow)" },
  cyan: { stroke: "var(--cyan)", glow: "var(--cyan-glow)" },
  success: { stroke: "var(--status-success)", glow: "rgba(34, 197, 94, 0.25)" },
  warning: { stroke: "var(--status-warning)", glow: "rgba(245, 158, 11, 0.25)" },
  error: { stroke: "var(--status-error)", glow: "rgba(239, 68, 68, 0.25)" },
};

export function CircularGauge({
  value,
  max = 100,
  label,
  sublabel,
  size = 120,
  strokeWidth = 8,
  color = "gold",
  className,
}: CircularGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const { stroke, glow } = colorMap[color];

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      gsap.fromTo(
        circle,
        { strokeDashoffset: circumference },
        {
          strokeDashoffset: offset,
          duration: 1.5,
          ease: "power3.out",
          delay: 0.3,
        }
      );
    };

    loadGSAP();
  }, [circumference, offset]);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--obsidian-border)"
            strokeWidth={strokeWidth}
          />
          {/* Value circle */}
          <circle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            style={{
              filter: `drop-shadow(0 0 6px ${glow})`,
              transition: "stroke-dashoffset 1.5s ease-out",
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold text-lg"
            style={{ color: stroke }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-[var(--text-muted)]">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
