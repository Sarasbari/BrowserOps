"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  /** Unique key to trigger re-animation on route change */
  transitionKey?: string;
}

/**
 * Camera Zoom Page Transition — Luxury spatial depth effect.
 * Content starts slightly scaled down with opacity 0 and zooms to full.
 * Uses pure CSS transforms for GPU-accelerated performance.
 */
export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset to initial state
    el.style.opacity = "0";
    el.style.transform = "scale(0.97) translateY(8px)";
    el.style.filter = "blur(4px)";

    // Force reflow
    el.getBoundingClientRect();

    // Trigger animation
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s ease-out";
      el.style.opacity = "1";
      el.style.transform = "scale(1) translateY(0)";
      el.style.filter = "blur(0px)";
    });
  }, [transitionKey]);

  return (
    <div
      ref={containerRef}
      className="will-change-transform"
      style={{
        opacity: 0,
        transform: "scale(0.97) translateY(8px)",
        filter: "blur(4px)",
      }}
    >
      {children}
    </div>
  );
}
