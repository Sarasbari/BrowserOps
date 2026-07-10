"use client";

import React from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge, CyanBadge } from "@/components/ui";
import {
  GitBranch,
  Plus,
  Play,
  Clock,
  MoreHorizontal,
  Calendar,
  CheckCircle2,
  Zap,
  Pencil,
} from "lucide-react";

const mockWorkflows = [
  {
    id: "wf-1",
    name: "Download Shopify Report",
    description: "Extracts daily sales report from Shopify admin panel",
    status: "PUBLISHED" as const,
    version: 3,
    lastRunStatus: "completed" as const,
    lastRunTime: "12 min ago",
    totalRuns: 156,
    successRate: 98.7,
    scheduleCron: "0 8 * * *",
    scheduleLabel: "Daily at 8:00 AM",
    steps: 7,
    selfHealEvents: 3,
  },
  {
    id: "wf-2",
    name: "Update Inventory Prices",
    description: "Syncs pricing data from supplier portal to internal system",
    status: "PUBLISHED" as const,
    version: 5,
    lastRunStatus: "failed" as const,
    lastRunTime: "38 min ago",
    totalRuns: 89,
    successRate: 91.0,
    scheduleCron: null,
    scheduleLabel: null,
    steps: 12,
    selfHealEvents: 8,
  },
  {
    id: "wf-3",
    name: "Scrape Competitor Pricing",
    description: "Monitors competitor product pricing across 3 websites",
    status: "PUBLISHED" as const,
    version: 2,
    lastRunStatus: "completed" as const,
    lastRunTime: "1h ago",
    totalRuns: 342,
    successRate: 94.2,
    scheduleCron: "0 */6 * * *",
    scheduleLabel: "Every 6 hours",
    steps: 9,
    selfHealEvents: 15,
  },
  {
    id: "wf-4",
    name: "Export CRM Contacts",
    description: "Weekly export of new CRM contacts to Google Sheets",
    status: "DRAFT" as const,
    version: 1,
    lastRunStatus: null,
    lastRunTime: null,
    totalRuns: 0,
    successRate: 0,
    scheduleCron: null,
    scheduleLabel: null,
    steps: 5,
    selfHealEvents: 0,
  },
];

export default function WorkflowsPage() {
  return (
    <>
      <TopBar title="Workflows" subtitle={`${mockWorkflows.length} workflows`} />

      <div className="flex-1 p-6">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20">
              All
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Published
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Drafts
            </button>
          </div>
          <Link href="/workflows/new/builder">
            <GoldButton size="md">
              <Plus className="h-4 w-4" />
              New Workflow
            </GoldButton>
          </Link>
        </div>

        {/* Workflow cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mockWorkflows.map((wf) => (
            <GlassCard
              key={wf.id}
              className="p-5"
              glow={wf.lastRunStatus === "failed" ? "none" : "none"}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--gold-subtle)]">
                    <GitBranch className="h-4 w-4 text-[var(--gold)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {wf.name}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {wf.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      wf.status === "PUBLISHED"
                        ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                        : "bg-[var(--obsidian-elevated)] text-[var(--text-muted)]"
                    }`}
                  >
                    {wf.status} v{wf.version}
                  </span>
                  <button className="p-1 rounded hover:bg-[var(--obsidian-elevated)] text-[var(--text-muted)]">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 mb-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {wf.totalRuns} runs
                </span>
                {wf.successRate > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                    {wf.successRate}%
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {wf.steps} steps
                </span>
                {wf.selfHealEvents > 0 && (
                  <span className="flex items-center gap-1 text-[var(--status-healed)]">
                    <Zap className="h-3 w-3" />
                    {wf.selfHealEvents} healed
                  </span>
                )}
              </div>

              {/* Schedule + last run */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--obsidian-border)]">
                <div className="flex items-center gap-3">
                  {wf.scheduleCron && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--cyan)] font-mono">
                      <Calendar className="h-3 w-3" />
                      {wf.scheduleLabel}
                    </span>
                  )}
                  {wf.lastRunStatus && (
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <StatusBadge
                        status={wf.lastRunStatus as "completed" | "failed"}
                        size="sm"
                      />
                      {wf.lastRunTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Link href={`/workflows/${wf.id}/builder`}>
                    <GoldButton variant="ghost" size="sm">
                      <Pencil className="h-3 w-3" />
                      Edit
                    </GoldButton>
                  </Link>
                  {wf.status === "PUBLISHED" && (
                    <GoldButton variant="secondary" size="sm">
                      <Play className="h-3 w-3" />
                      Run
                    </GoldButton>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
