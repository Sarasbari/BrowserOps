"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
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
  Loader2,
  AlertCircle,
} from "lucide-react";
import { fetchSchedules, fetchWorkflows } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

export default function SchedulesPage() {
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [cronExpr, setCronExpr] = useState("0 8 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR("/api/schedules", fetchSchedules);
  
  // We need workflows to populate the dropdown when creating a schedule
  const { data: workflowsData } = useSWR("/api/workflows", fetchWorkflows);

  const filteredSchedules = React.useMemo(() => {
    if (!data?.schedules) return [];
    if (filter === "ALL") return data.schedules;
    return data.schedules.filter((s) => 
      filter === "ACTIVE" ? s.isActive : !s.isActive
    );
  }, [data, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowId || !cronExpr) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, cronExpr, timezone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create schedule");
      }

      await mutate("/api/schedules");
      setShowAdd(false);
      setWorkflowId("");
      setCronExpr("0 8 * * *");
      setTimezone("UTC");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    setIsToggling(id);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      });

      if (!res.ok) throw new Error("Failed to update schedule");
      await mutate("/api/schedules");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete schedule");
      await mutate("/api/schedules");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  if (error) {
    return (
      <>
        <TopBar title="Schedules" subtitle="Error loading schedules" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load schedules.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Schedules" subtitle={data ? `${data.schedules.length} scheduled workflows` : "Loading..."} />

      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {(["ALL", "ACTIVE", "PAUSED"] as const).map((f) => (
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
          <GoldButton size="md" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            {showAdd ? "Cancel" : "New Schedule"}
          </GoldButton>
        </div>

        {/* Add schedule form */}
        {showAdd && (
          <GlassCard className="p-5 mb-6" glow="gold" hover={false}>
            <h3 className="text-sm font-semibold text-[var(--gold)] mb-4">
              Create Schedule
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Workflow
                </label>
                <select
                  required
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                >
                  <option value="" disabled>Select a workflow...</option>
                  {workflowsData?.workflows.map((wf) => (
                    <option key={wf.id} value={wf.id} disabled={wf.status !== "PUBLISHED"}>
                      {wf.name} {wf.status !== "PUBLISHED" ? "(Must be published)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    required
                    value={cronExpr}
                    onChange={(e) => setCronExpr(e.target.value)}
                    placeholder="* * * * *"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm font-mono text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    min hour dom mon dow
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Timezone
                  </label>
                  <input
                    type="text"
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="UTC"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <GoldButton size="md" type="submit" disabled={isSubmitting || !workflowId}>
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                  Create Schedule
                </GoldButton>
              </div>
            </form>
          </GlassCard>
        )}

        {/* Loading state */}
        {isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data && filteredSchedules.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--obsidian-surface)] mb-4">
              <Calendar className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              No schedules found
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {filter === "ALL"
                ? "You haven't scheduled any workflows yet."
                : `No schedules match the "${filter.toLowerCase()}" filter.`}
            </p>
          </div>
        )}

        {/* Schedules list */}
        {data && filteredSchedules.length > 0 && (
          <div className="space-y-4">
            {filteredSchedules.map((schedule) => (
              <GlassCard
                key={schedule.id}
                className="p-5"
                glow="none"
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
                        {schedule.workflow.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-[var(--cyan)]">
                          {schedule.cronExpr}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--obsidian-surface)] px-1.5 py-0.5 rounded">
                          {schedule.timezone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(schedule.id, schedule.isActive)}
                      disabled={isToggling === schedule.id}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors disabled:opacity-50 ${
                        schedule.isActive
                          ? "bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)]"
                          : "bg-[var(--obsidian-elevated)] text-[var(--text-muted)] hover:bg-[var(--status-success)]/10 hover:text-[var(--status-success)]"
                      }`}
                    >
                      {isToggling === schedule.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : schedule.isActive ? (
                        <>
                          <Pause className="h-3 w-3" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span>Paused</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      disabled={isDeleting === schedule.id}
                      className="p-1 rounded text-[var(--status-error)] hover:bg-[var(--obsidian-elevated)] transition-colors disabled:opacity-50"
                      title="Delete Schedule"
                    >
                      {isDeleting === schedule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 py-3 border-t border-[var(--obsidian-border)] mt-2">
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                      Created
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Calendar className="h-3 w-3" />
                      {formatRelativeTime(schedule.createdAt)}
                    </div>
                  </div>
                  
                  {/* Status row from original mock - placeholders if not actively tracked */}
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                      Last Run
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      {schedule.lastRunAt ? formatRelativeTime(schedule.lastRunAt) : "—"}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                      Next Run
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      {schedule.nextRunAt ? formatRelativeTime(schedule.nextRunAt) : "—"}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end">
                    <button className="text-[11px] text-[var(--text-muted)] hover:text-[var(--cyan)] transition-colors flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />
                      Trigger Now
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
