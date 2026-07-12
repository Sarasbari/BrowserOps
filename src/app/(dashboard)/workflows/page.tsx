"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge, CyanBadge } from "@/components/ui";
import {
  GitBranch,
  Plus,
  Play,
  Clock,
  MoreHorizontal,
  Calendar,
  Pencil,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { fetchWorkflows } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

export default function WorkflowsPage() {
  const [filter, setFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const { data, error, isLoading } = useSWR("/api/workflows", fetchWorkflows);

  // Filter workflows on the client side for simplicity
  const filteredWorkflows = React.useMemo(() => {
    if (!data?.workflows) return [];
    if (filter === "ALL") return data.workflows;
    return data.workflows.filter((w) => w.status === filter);
  }, [data, filter]);

  if (error) {
    return (
      <>
        <TopBar title="Workflows" subtitle="Error loading workflows" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load workflows.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Workflows" subtitle={data ? `${data.workflows.length} workflows` : "Loading..."} />

      <div className="flex-1 p-6">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "ALL"
                  ? "bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("PUBLISHED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "PUBLISHED"
                  ? "bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)]"
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setFilter("DRAFT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "DRAFT"
                  ? "bg-[var(--gold-subtle)] text-[var(--gold)] border border-[var(--gold)]/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--obsidian-elevated)]"
              }`}
            >
              Drafts
            </button>
          </div>
          <GoldButton size="md" onClick={() => {
            // Optimistic navigation could be added, but standard link is fine
            window.location.href = "/workflows/new/builder";
          }}>
            <Plus className="h-4 w-4" />
            New Workflow
          </GoldButton>
        </div>

        {/* Loading state */}
        {isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data && filteredWorkflows.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--obsidian-surface)] mb-4">
              <GitBranch className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              No workflows found
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {filter === "ALL"
                ? "You haven't created any workflows yet."
                : `No workflows match the "${filter.toLowerCase()}" filter.`}
            </p>
          </div>
        )}

        {/* Workflow cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWorkflows.map((wf) => {
            const versionStr = wf.versions?.[0]?.version || 1;
            const schedule = (wf as any).schedules?.[0]; // Types need a bit of generic massaging
            
            return (
              <GlassCard
                key={wf.id}
                className="p-5 flex flex-col h-full"
                glow="none"
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
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {wf.description || "No description"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        wf.status === "PUBLISHED"
                          ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                          : "bg-[var(--obsidian-elevated)] text-[var(--text-muted)]"
                      }`}
                    >
                      {wf.status} v{versionStr}
                    </span>
                    <button className="p-1 rounded hover:bg-[var(--obsidian-elevated)] text-[var(--text-muted)]">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Stats row - simplified for real data */}
                <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-muted)] flex-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatRelativeTime(wf.updatedAt)}
                  </span>
                </div>

                {/* Schedule + actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--obsidian-border)] mt-auto">
                  <div className="flex items-center gap-3">
                    {schedule ? (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--cyan)] font-mono" title={`Cron: ${schedule.cronExpr}`}>
                        <Calendar className="h-3 w-3" />
                        Scheduled
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">Manual trigger</span>
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
                      <button
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-8 px-3 text-xs bg-[var(--obsidian-surface)] text-[var(--text-primary)] hover:bg-[var(--obsidian-border)] border border-[var(--obsidian-border)]"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/runs", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ workflowId: wf.id, testRun: false }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              window.location.href = `/runs/${data.run.id}`;
                            } else {
                              alert("Failed to start run.");
                            }
                          } catch (e) {
                            alert("Error starting run.");
                          }
                        }}
                      >
                        <Play className="h-3 w-3" />
                        Run
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </>
  );
}
