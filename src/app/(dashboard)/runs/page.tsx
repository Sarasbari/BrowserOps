"use client";

import React from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge, CyanBadge } from "@/components/ui";
import {
  Play,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Filter,
  Download,
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";

const mockRuns = [
  { id: "run-1", workflow: "Download Shopify Report", version: 3, status: "completed" as RunStatus, duration: "2m 14s", browserMin: 2.23, startedAt: "Today 10:23 AM", selfHealed: false, steps: { total: 7, completed: 7 } },
  { id: "run-2", workflow: "Update Inventory Prices", version: 5, status: "failed" as RunStatus, duration: "0m 47s", browserMin: 0.78, startedAt: "Today 9:45 AM", selfHealed: false, steps: { total: 12, completed: 4 }, error: "Element not found: #price-table" },
  { id: "run-3", workflow: "Scrape Competitor Pricing", version: 2, status: "completed" as RunStatus, duration: "5m 02s", browserMin: 5.03, startedAt: "Today 9:00 AM", selfHealed: true, steps: { total: 9, completed: 9 } },
  { id: "run-4", workflow: "Submit Weekly Report", version: 1, status: "running" as RunStatus, duration: "1m 23s", browserMin: 1.38, startedAt: "Now", selfHealed: false, steps: { total: 8, completed: 5 } },
  { id: "run-5", workflow: "Export CRM Contacts", version: 1, status: "paused" as RunStatus, duration: "3m 41s", browserMin: 3.68, startedAt: "Today 8:42 AM", selfHealed: false, steps: { total: 5, completed: 3 }, pauseReason: "CAPTCHA detected" },
  { id: "run-6", workflow: "Download Shopify Report", version: 3, status: "completed" as RunStatus, duration: "2m 08s", browserMin: 2.13, startedAt: "Yesterday 10:00 AM", selfHealed: false, steps: { total: 7, completed: 7 } },
  { id: "run-7", workflow: "Scrape Competitor Pricing", version: 2, status: "completed" as RunStatus, duration: "4m 56s", browserMin: 4.93, startedAt: "Yesterday 3:00 AM", selfHealed: true, steps: { total: 9, completed: 9 } },
];

export default function RunsPage() {
  return (
    <>
      <TopBar title="Run History" subtitle={`${mockRuns.length} runs`} />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20">
              All
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Running
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Failed
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
              Paused
            </button>
          </div>
          <div className="flex items-center gap-2">
            <GoldButton variant="ghost" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </GoldButton>
            <GoldButton variant="ghost" size="sm">
              <Download className="h-3.5 w-3.5" />
              Export
            </GoldButton>
          </div>
        </div>

        {/* Runs table */}
        <GlassCard className="overflow-hidden" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--obsidian-border)]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Steps
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Browser Min
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Started
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-[var(--obsidian-border)] last:border-0 hover:bg-[var(--obsidian-surface)]/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">
                          {run.workflow}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            v{run.version}
                          </span>
                          {run.selfHealed && (
                            <CyanBadge>
                              <Zap className="h-2 w-2" />
                              Healed
                            </CyanBadge>
                          )}
                          {(run as { pauseReason?: string }).pauseReason && (
                            <span className="text-[10px] text-[var(--gold)]">
                              {(run as { pauseReason?: string }).pauseReason}
                            </span>
                          )}
                          {(run as { error?: string }).error && (
                            <span className="text-[10px] text-[var(--status-error)]">
                              {(run as { error?: string }).error}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-[var(--obsidian-surface)] rounded-full overflow-hidden max-w-[60px]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(run.steps.completed / run.steps.total) * 100}%`,
                              backgroundColor:
                                run.status === "failed"
                                  ? "var(--status-error)"
                                  : run.status === "paused"
                                  ? "var(--gold)"
                                  : "var(--status-success)",
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {run.steps.completed}/{run.steps.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {run.duration}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-[var(--gold)]">
                        {run.browserMin}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">
                        {run.startedAt}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {run.status === "paused" && (
                          <GoldButton size="sm">
                            <AlertTriangle className="h-3 w-3" />
                            Intervene
                          </GoldButton>
                        )}
                        <Link href={`/runs/${run.id}`}>
                          <GoldButton variant="ghost" size="sm">
                            <Eye className="h-3 w-3" />
                            Replay
                          </GoldButton>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
