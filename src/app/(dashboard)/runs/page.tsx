"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
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
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";
import { fetchRuns } from "@/lib/api-client";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

export default function RunsPage() {
  const [filter, setFilter] = useState<string>("ALL");
  const { data, error, isLoading } = useSWR("/api/runs", fetchRuns, {
    refreshInterval: 5000, // Poll every 5 seconds for updates
  });

  const filteredRuns = React.useMemo(() => {
    if (!data?.runs) return [];
    if (filter === "ALL") return data.runs;
    return data.runs.filter((r) => r.status.toUpperCase() === filter);
  }, [data, filter]);

  if (error) {
    return (
      <>
        <TopBar title="Run History" subtitle="Error loading runs" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load run history.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Run History" subtitle={data ? `${data.runs.length} runs` : "Loading..."} />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {["ALL", "RUNNING", "FAILED", "PAUSED"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)]"
                }`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
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

        {/* Loading state */}
        {isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data && filteredRuns.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--obsidian-surface)] mb-4">
              <Play className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              No runs found
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {filter === "ALL"
                ? "You haven't run any workflows yet."
                : `No runs match the "${filter.toLowerCase()}" filter.`}
            </p>
          </div>
        )}

        {/* Runs table */}
        {!isLoading && data && filteredRuns.length > 0 && (
          <GlassCard className="overflow-hidden" hover={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--obsidian-border)] bg-[var(--obsidian-surface)]">
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
                  {filteredRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-[var(--obsidian-border)] last:border-0 hover:bg-[var(--obsidian-surface)]/50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status.toLowerCase() as RunStatus} size="sm" />
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {run.version.workflow.name}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            Version {run.version.version}
                            {run.failureReason && (
                              <span className="text-[var(--status-error)] ml-2">
                                • {run.failureReason}
                              </span>
                            )}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
                          <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                          <span>
                            {run._count.stepLogs} / ?
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(run.durationMs)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          {run.browserMinutes?.toFixed(2) || "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatRelativeTime(run.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/runs/${run.id}`}>
                            <GoldButton variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                              <Eye className="h-3.5 w-3.5" />
                              View
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
        )}
      </div>
    </>
  );
}
