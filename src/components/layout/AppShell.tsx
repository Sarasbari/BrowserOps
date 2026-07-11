"use client";

import React, { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/layout/PageTransition";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Nebula background */}
      <div className="nebula-bg" />

      {/* Grain texture (CSS handles via body::before) */}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area with page transition */}
      <main className="flex-1 ml-[240px] flex flex-col">
        <PageTransition transitionKey={pathname}>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
