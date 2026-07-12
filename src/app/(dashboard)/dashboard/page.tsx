"use client";

import React from "react";
import useSWR from "swr";
import { TopBar } from "@/components/layout/TopBar";
import {
  GlassCard,
  GoldButton,
  StatusBadge,
  CyanBadge,
  BentoGrid,
  BentoItem,
  CircularGauge,
} from "@/components/ui";
import {
  Play,
  GitBranch,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  Bot,
  TrendingUp,
  Activity,
  Hand,
  Loader2,
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";
import { fetchStats } from "@/lib/api-client";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR("/api/stats", fetchStats, {
    refreshInterval: 10000, // Refresh every 10 seconds
  });

  if (error) {
    return (
      <>
        <TopBar title="Command Center" subtitle="Real-time automation overview" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load dashboard stats.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <TopBar title="Command Center" subtitle="Real-time automation overview" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
        </div>
      </>
    );
  }

  const activeRuns = data.runs.byStatus["RUNNING"] || 0;
  const pausedRuns = data.runs.byStatus["PAUSED"] || 0;
  
  // Storage logic isn't fully implemented in the backend yet, default to 0
  const storageUsed = 0; 
  const storageTotal = 5;

  return (
    <>
      <TopBar title="Command Center" subtitle="Real-time automation overview" />

      <div className="flex-1 p-6 space-y-6">
        <BentoGrid columns={3}>
          {/* ── Hero: Active Bot Visualization ── */}
          <BentoItem colSpan={2}>
            <GlassCard className="p-6 h-full min-h-[280px]" glow={activeRuns > 0 ? "cyan" : "none"} hover={false}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                    Automation Engine
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {data.workflows.active} active workflows • {data.runs.total} total runs
                  </p>
                </div>
                {activeRuns > 0 && (
                  <CyanBadge>
                    <Activity className="h-3 w-3" />
                    LIVE
                  </CyanBadge>
                )}
              </div>

              {/* Animated bot visualization */}
              <div className="relative flex items-center justify-center h-[160px]">
                {/* Orbital rings */}
                <div className="absolute w-40 h-40 rounded-full border border-[var(--cyan)]/10 animate-spin" style={{ animationDuration: "20s" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--cyan)] glow-cyan" />
                </div>
                <div className="absolute w-56 h-56 rounded-full border border-[var(--gold)]/10 animate-spin" style={{ animationDuration: "30s", animationDirection: "reverse" }}>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[var(--gold)] glow-gold" />
                </div>
                <div className="absolute w-72 h-72 rounded-full border border-[var(--cyan)]/5 animate-spin" style={{ animationDuration: "45s" }}>
                  <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--cyan)]/60" />
                </div>

                {/* Central bot icon */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold-dim)] to-[var(--gold)] shadow-xl animate-float">
                  <Bot className="h-10 w-10 text-[var(--obsidian)]" />
                  {data.selfHealing.healed > 0 && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--cyan)] border-2 border-[var(--obsidian)] flex items-center justify-center">
                      <Zap className="h-2.5 w-2.5 text-[var(--obsidian)]" />
                    </div>
                  )}
                </div>

                {/* Throughput stats */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4">
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--cyan)]">{activeRuns}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Running</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--gold)]">{pausedRuns}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Awaiting HITL</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--status-success)]">{data.runs.total}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Total Runs</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </BentoItem>

          {/* ── HITL Alert Card ── */}
          <BentoItem>
            <GlassCard
              className="p-5 h-full min-h-[280px] flex flex-col"
              glow={pausedRuns > 0 ? "gold" : "none"}
              hover={true}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-[var(--gold-subtle)]">
                  <Hand className="h-4 w-4 text-[var(--gold)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--gold)]">
                    Human Intervention
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {pausedRuns === 0 ? "No workflows need attention" : `${pausedRuns} workflow${pausedRuns !== 1 ? 's' : ''} need${pausedRuns === 1 ? 's' : ''} your attention`}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-3">
                {pausedRuns > 0 ? (
                  <div className="p-3 rounded-lg bg-[var(--gold-subtle)] border border-[var(--gold)]/20 animate-pulse-gold">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--gold)]">
                        Active Intervention
                      </span>
                      <StatusBadge status="paused" size="sm" />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mb-3">
                      A workflow requires manual resolution to continue.
                    </p>
                    <Link href="/runs" className="block w-full">
                      <GoldButton size="sm" className="w-full">
                        <Eye className="h-3 w-3" />
                        Take Over
                      </GoldButton>
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
                    <CheckCircle2 className="h-8 w-8 text-[var(--status-success)] mb-3 opacity-80" />
                    <p className="text-xs text-[var(--text-muted)]">All workflows are running smoothly automatically.</p>
                  </div>
                )}

                {/* Recent HITL history - currently mocking this specific part since we don't have HITL resolution history in DB yet */}
                {pausedRuns > 0 && (
                  <div className="text-xs text-[var(--text-muted)] space-y-1.5 mt-auto">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-[var(--text-muted)]" />
                      <span>Check the runs page for details.</span>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </BentoItem>

          {/* ── Quick Stats Row ── */}
          <BentoItem>
            <GlassCard className="p-5 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--status-success)]/10">
                  <TrendingUp className="h-4 w-4 text-[var(--status-success)]" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-bold text-[var(--text-primary)]">
                    {data.runs.successRate}%
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Success Rate
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <Zap className="h-3 w-3 text-[var(--status-healed)]" />
                <span>{data.selfHealing.rate}% self-heal rate</span>
              </div>
            </GlassCard>
          </BentoItem>

          <BentoItem>
            <GlassCard className="p-5 h-full flex items-center justify-center">
              <CircularGauge
                value={data.usage.browserMinutes}
                max={500}
                label="Browser Minutes"
                sublabel={`${data.usage.browserMinutes} / 500 min`}
                color="gold"
                size={110}
              />
            </GlassCard>
          </BentoItem>

          <BentoItem>
            <GlassCard className="p-5 h-full flex items-center justify-center">
              <CircularGauge
                value={storageUsed}
                max={storageTotal}
                label="Storage Used"
                sublabel={`${storageUsed} / ${storageTotal} GB`}
                color="cyan"
                size={110}
              />
            </GlassCard>
          </BentoItem>

          {/* ── Recent Runs ── */}
          <BentoItem colSpan={2}>
            <GlassCard className="p-5 h-full" hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Recent Runs
                </h3>
                <Link href="/runs">
                  <GoldButton variant="ghost" size="sm">
                    View All
                  </GoldButton>
                </Link>
              </div>

              {data.runs.recent.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-[var(--text-muted)]">No runs yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.runs.recent.map((run) => (
                    <Link
                      href={`/runs/${run.id}`}
                      key={run.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--obsidian-surface)]/50 hover:bg-[var(--obsidian-elevated)] transition-colors duration-200 cursor-pointer group"
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {run.status === "COMPLETED" && (
                          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                        )}
                        {run.status === "FAILED" && (
                          <XCircle className="h-4 w-4 text-[var(--status-error)]" />
                        )}
                        {(run.status === "RUNNING" || run.status === "QUEUED") && (
                          <Play className="h-4 w-4 text-[var(--cyan)]" />
                        )}
                        {run.status === "PAUSED" && (
                          <AlertTriangle className="h-4 w-4 text-[var(--gold)]" />
                        )}
                        {run.status === "CANCELLED" && (
                          <XCircle className="h-4 w-4 text-[var(--text-muted)]" />
                        )}
                      </div>

                      {/* Workflow name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate">
                          {run.version.workflow.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {formatRelativeTime(run.createdAt)}
                        </p>
                      </div>

                      {/* Status + Duration */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {formatDuration(run.durationMs)}
                        </span>
                        <StatusBadge status={run.status.toLowerCase() as RunStatus} size="sm" />
                      </div>

                      {/* Replay button */}
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[var(--obsidian-border)] text-[var(--text-muted)] hover:text-[var(--cyan)]">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>
          </BentoItem>

          {/* ── Quick Actions ── */}
          <BentoItem>
            <GlassCard className="p-5 h-full" hover={false}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link href="/workflows/new/builder" className="block w-full">
                  <GoldButton className="w-full justify-start" size="md">
                    <GitBranch className="h-4 w-4" />
                    New Workflow
                  </GoldButton>
                </Link>
                <Link href="/workflows" className="block w-full">
                  <GoldButton
                    variant="secondary"
                    className="w-full justify-start"
                    size="md"
                  >
                    <Play className="h-4 w-4" />
                    Run Workflow
                  </GoldButton>
                </Link>
                <Link href="/schedules" className="block w-full">
                  <GoldButton
                    variant="ghost"
                    className="w-full justify-start"
                    size="md"
                  >
                    <Clock className="h-4 w-4" />
                    New Schedule
                  </GoldButton>
                </Link>
              </div>
            </GlassCard>
          </BentoItem>
        </BentoGrid>
      </div>
    </>
  );
}
