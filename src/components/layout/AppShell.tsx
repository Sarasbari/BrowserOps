"use client";

import React, { type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* Nebula background */}
      <div className="nebula-bg" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 ml-[240px] flex flex-col">
        {children}
      </main>
    </div>
  );
}
