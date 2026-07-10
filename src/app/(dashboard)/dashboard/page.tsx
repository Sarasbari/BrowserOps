"use client";

import React from "react";
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
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";

// ── Mock Data ──
const recentRuns = [
  {
    id: "run-1",
    workflow: "Download Shopify Report",
    status: "completed" as RunStatus,
    duration: "2m 14s",
    time: "12 min ago",
    selfHealed: false,
  },
  {
    id: "run-2",
    workflow: "Update Inventory Prices",
    status: "failed" as RunStatus,
    duration: "0m 47s",
    time: "38 min ago",
    selfHealed: false,
  },
  {
    id: "run-3",
    workflow: "Scrape Competitor Pricing",
    status: "completed" as RunStatus,
    duration: "5m 02s",
    time: "1h ago",
    selfHealed: true,
  },
  {
    id: "run-4",
    workflow: "Submit Weekly Report",
    status: "running" as RunStatus,
    duration: "1m 23s",
    time: "Just now",
    selfHealed: false,
  },
  {
    id: "run-5",
    workflow: "Export CRM Contacts",
    status: "paused" as RunStatus,
    duration: "3m 41s",
    time: "5 min ago",
    selfHealed: false,
  },
];

const stats = {
  totalRuns: 847,
  successRate: 94.2,
  selfHealRate: 73,
  activeWorkflows: 12,
  browserMinutes: { used: 342, total: 500 },
  storageUsed: { used: 2.1, total: 5 },
};

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Command Center" subtitle="Real-time automation overview" />

      <div className="flex-1 p-6 space-y-6">
        <BentoGrid columns={3}>
          {/* ── Hero: Active Bot Visualization ── */}
          <BentoItem colSpan={2}>
            <GlassCard className="p-6 h-full min-h-[280px]" glow="cyan" hover={false}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                    Automation Engine
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {stats.activeWorkflows} active workflows • {stats.totalRuns} total runs
                  </p>
                </div>
                <CyanBadge>
                  <Activity className="h-3 w-3" />
                  LIVE
                </CyanBadge>
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
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--cyan)] border-2 border-[var(--obsidian)] flex items-center justify-center">
                    <Zap className="h-2.5 w-2.5 text-[var(--obsidian)]" />
                  </div>
                </div>

                {/* Throughput stats */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4">
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--cyan)]">4</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Running</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--gold)]">1</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Awaiting HITL</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--status-success)]">847</p>
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
              glow="gold"
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
                    1 workflow needs your attention
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-3">
                {/* Active HITL request */}
                <div className="p-3 rounded-lg bg-[var(--gold-subtle)] border border-[var(--gold)]/20 animate-pulse-gold">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--gold)]">
                      Export CRM Contacts
                    </span>
                    <StatusBadge status="paused" size="sm" />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-3">
                    CAPTCHA detected on login page. Manual resolution required.
                  </p>
                  <GoldButton size="sm" className="w-full">
                    <Eye className="h-3 w-3" />
                    Take Over
                  </GoldButton>
                </div>

                {/* Recent HITL history */}
                <div className="text-xs text-[var(--text-muted)] space-y-1.5 mt-auto">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                    <span>2FA resolved — 22 min ago</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                    <span>Pop-up dismissed — 1h ago</span>
                  </div>
                </div>
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
                    {stats.successRate}%
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Success Rate
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <Zap className="h-3 w-3 text-[var(--status-healed)]" />
                <span>{stats.selfHealRate}% self-heal rate</span>
              </div>
            </GlassCard>
          </BentoItem>

          <BentoItem>
            <GlassCard className="p-5 h-full flex items-center justify-center">
              <CircularGauge
                value={stats.browserMinutes.used}
                max={stats.browserMinutes.total}
                label="Browser Minutes"
                sublabel={`${stats.browserMinutes.used} / ${stats.browserMinutes.total} min`}
                color="gold"
                size={110}
              />
            </GlassCard>
          </BentoItem>

          <BentoItem>
            <GlassCard className="p-5 h-full flex items-center justify-center">
              <CircularGauge
                value={stats.storageUsed.used}
                max={stats.storageUsed.total}
                label="Storage Used"
                sublabel={`${stats.storageUsed.used} / ${stats.storageUsed.total} GB`}
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
                <GoldButton variant="ghost" size="sm">
                  View All
                </GoldButton>
              </div>

              <div className="space-y-2">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--obsidian-surface)]/50 hover:bg-[var(--obsidian-elevated)] transition-colors duration-200 cursor-pointer group"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {run.status === "completed" && (
                        <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                      )}
                      {run.status === "failed" && (
                        <XCircle className="h-4 w-4 text-[var(--status-error)]" />
                      )}
                      {run.status === "running" && (
                        <Play className="h-4 w-4 text-[var(--cyan)]" />
                      )}
                      {run.status === "paused" && (
                        <AlertTriangle className="h-4 w-4 text-[var(--gold)]" />
                      )}
                    </div>

                    {/* Workflow name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {run.workflow}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {run.time}
                      </p>
                    </div>

                    {/* Self-healed badge */}
                    {run.selfHealed && (
                      <CyanBadge>
                        <Zap className="h-2.5 w-2.5" />
                        Self-healed
                      </CyanBadge>
                    )}

                    {/* Status + Duration */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {run.duration}
                      </span>
                      <StatusBadge status={run.status} size="sm" />
                    </div>

                    {/* Replay button */}
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[var(--obsidian-border)] text-[var(--text-muted)] hover:text-[var(--cyan)]">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          </BentoItem>

          {/* ── Quick Actions ── */}
          <BentoItem>
            <GlassCard className="p-5 h-full" hover={false}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <GoldButton className="w-full justify-start" size="md">
                  <GitBranch className="h-4 w-4" />
                  New Workflow
                </GoldButton>
                <GoldButton
                  variant="secondary"
                  className="w-full justify-start"
                  size="md"
                >
                  <Play className="h-4 w-4" />
                  Run Workflow
                </GoldButton>
                <GoldButton
                  variant="ghost"
                  className="w-full justify-start"
                  size="md"
                >
                  <Clock className="h-4 w-4" />
                  New Schedule
                </GoldButton>
              </div>
            </GlassCard>
          </BentoItem>
        </BentoGrid>
      </div>
    </>
  );
}
