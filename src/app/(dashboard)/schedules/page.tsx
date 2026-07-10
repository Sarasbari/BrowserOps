"use client";

import React from "react";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge } from "@/components/ui";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

const mockSchedules = [
  {
    id: "sched-1",
    workflow: "Download Shopify Report",
    cronExpr: "0 8 * * *",
    humanReadable: "Every day at 8:00 AM",
    timezone: "America/New_York",
    isActive: true,
    lastRunAt: "Today 8:00 AM",
    lastRunStatus: "completed" as const,
    nextRunAt: "Tomorrow 8:00 AM",
    totalRuns: 45,
    successRate: 97.8,
  },
  {
    id: "sched-2",
    workflow: "Scrape Competitor Pricing",
    cronExpr: "0 */6 * * *",
    humanReadable: "Every 6 hours",
    timezone: "UTC",
    isActive: true,
    lastRunAt: "Today 6:00 AM",
    lastRunStatus: "completed" as const,
    nextRunAt: "Today 12:00 PM",
    totalRuns: 120,
    successRate: 94.2,
  },
  {
    id: "sched-3",
    workflow: "Weekly CRM Sync",
    cronExpr: "0 9 * * MON",
    humanReadable: "Every Monday at 9:00 AM",
    timezone: "Europe/London",
    isActive: false,
    lastRunAt: "Last Monday",
    lastRunStatus: "failed" as const,
    nextRunAt: "—",
    totalRuns: 8,
    successRate: 87.5,
  },
];

export default function SchedulesPage() {
  return (
    <>
      <TopBar title="Schedules" subtitle={`${mockSchedules.length} scheduled workflows`} />

      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20">
              All
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Active
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Paused
            </button>
          </div>
          <GoldButton size="md">
            <Plus className="h-4 w-4" />
            New Schedule
          </GoldButton>
        </div>

        <div className="space-y-4">
          {mockSchedules.map((schedule) => (
            <GlassCard
              key={schedule.id}
              className="p-5"
              glow={schedule.isActive ? "none" : "none"}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      schedule.isActive
                        ? "bg-[var(--cyan-subtle)]"
                        : "bg-[var(--obsidian-elevated)]"
                    }`}
                  >
                    <Clock
                      className={`h-5 w-5 ${
                        schedule.isActive
                          ? "text-[var(--cyan)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {schedule.workflow}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-[var(--cyan)]">
                        {schedule.cronExpr}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        — {schedule.humanReadable}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] bg-[var(--obsidian-surface)] px-1.5 py-0.5 rounded">
                        {schedule.timezone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                      schedule.isActive
                        ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                        : "bg-[var(--obsidian-elevated)] text-[var(--text-muted)]"
                    }`}
                  >
                    {schedule.isActive ? "Active" : "Paused"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 py-3 border-t border-b border-[var(--obsidian-border)]">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                    Last Run
                  </p>
                  <div className="flex items-center gap-1.5">
                    {schedule.lastRunStatus === "completed" ? (
                      <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                    ) : (
                      <XCircle className="h-3 w-3 text-[var(--status-error)]" />
                    )}
                    <span className="text-xs text-[var(--text-secondary)]">
                      {schedule.lastRunAt}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                    Next Run
                  </p>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {schedule.nextRunAt}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                    Total Runs
                  </p>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">
                    {schedule.totalRuns}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                    Success Rate
                  </p>
                  <span
                    className={`text-xs font-mono ${
                      schedule.successRate >= 95
                        ? "text-[var(--status-success)]"
                        : schedule.successRate >= 90
                        ? "text-[var(--status-warning)]"
                        : "text-[var(--status-error)]"
                    }`}
                  >
                    {schedule.successRate}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-1">
                  <GoldButton variant="ghost" size="sm">
                    <RotateCcw className="h-3 w-3" />
                    Run Now
                  </GoldButton>
                </div>
                <div className="flex items-center gap-1">
                  <GoldButton variant="ghost" size="sm">
                    {schedule.isActive ? (
                      <>
                        <Pause className="h-3 w-3" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Resume
                      </>
                    )}
                  </GoldButton>
                  <GoldButton variant="ghost" size="sm">
                    <Trash2 className="h-3 w-3 text-[var(--status-error)]" />
                  </GoldButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
