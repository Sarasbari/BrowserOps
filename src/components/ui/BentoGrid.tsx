"use client";

import React, { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export function BentoGrid({
  children,
  className,
  columns = 3,
}: BentoGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    // GSAP staggered 3D flip entrance
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;

      const items = grid.querySelectorAll("[data-bento-item]");
      gsap.fromTo(
        items,
        {
          rotateX: -90,
          rotateY: 15,
          opacity: 0,
          y: 60,
          scale: 0.9,
          transformPerspective: 1200,
          transformOrigin: "center bottom",
        },
        {
          rotateX: 0,
          rotateY: 0,
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: {
            each: 0.1,
            from: "start",
          },
        }
      );
    };

    loadGSAP();
  }, []);

  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      ref={gridRef}
      className={cn(
        "grid gap-4",
        colClasses[columns],
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoItemProps {
  children: ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
}

export function BentoItem({
  children,
  className,
  colSpan = 1,
  rowSpan = 1,
}: BentoItemProps) {
  const spanClasses = cn(
    colSpan === 2 && "md:col-span-2",
    colSpan === 3 && "md:col-span-2 lg:col-span-3",
    rowSpan === 2 && "row-span-2"
  );

  return (
    <div
      data-bento-item
      className={cn(spanClasses, "opacity-0", className)}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}
