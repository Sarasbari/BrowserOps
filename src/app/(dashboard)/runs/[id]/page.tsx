"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge } from "@/components/ui";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Volume2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Hand,
  Globe,
  MousePointerClick,
  Keyboard,
  Table,
  Save,
  Loader2,
  AlertCircle,
  LucideIcon,
  Search,
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

// Helper to fetch run details
const fetchRun = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch run details");
  }
  return res.json().then((d) => d.run);
};

// Map step types to icons
const getStepIcon = (type: string): LucideIcon => {
  switch (type) {
    case "open_url": return Globe;
    case "type_text": return Keyboard;
    case "click_element": return MousePointerClick;
    case "wait_for_selector": return Clock;
    case "extract_data": return Table;
    default: return Play;
  }
};

export default function TheaterPage() {
  const params = useParams();
  const id = params.id as string;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  
  const { data: run, error, isLoading } = useSWR(`/api/runs/${id}`, fetchRun, {
    refreshInterval: 3000, // Poll more frequently for active runs
  });

  const isHITLMode = run?.status === "PAUSED";
  
  // Set total time based on run duration
  useEffect(() => {
    if (run?.durationMs && totalTime === 0) {
      setTotalTime(Math.floor(run.durationMs / 1000));
    }
  }, [run, totalTime]);

  // Keep active step in sync with the last running/completed step if playing
  useEffect(() => {
    if (run?.stepLogs && isPlaying) {
      // Just a simple auto-advance mock for the UI
      const timer = setInterval(() => {
        setCurrentTime((prev) => Math.min(prev + 1, totalTime));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPlaying, run, totalTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <>
        <TopBar title="Theater" subtitle="Error loading run" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load run details.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

  if (isLoading || !run) {
    return (
      <>
        <TopBar title="Theater" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
        </div>
      </>
    );
  }

  // Safely parse steps from the version JSON
  const steps = (run.version.steps as any[]) || [];
  
  // Combine steps with their logs
  const combinedSteps = steps.map((step, index) => {
    const log = run.stepLogs?.find((l: any) => l.stepIndex === index);
    return {
      index,
      step,
      log,
      status: log?.status || "pending",
      duration: log?.durationMs ? formatDuration(log.durationMs) : "--",
      selfHealed: !!log?.selfHealed,
      error: log?.error,
    };
  });

  const activeStepData = combinedSteps[activeStep];

  return (
    <>
      <TopBar
        title="Theater"
        subtitle={`${run.version.workflow.name} — Run #${run.id.slice(-6)}`}
      />

      <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden">
        {/* ── Main Viewport ── */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Video viewport with gold frame */}
          <div
            className={`flex-1 relative rounded-xl overflow-hidden ${
              isHITLMode
                ? "animate-pulse-gold ring-2 ring-[var(--gold)]"
                : "ring-1 ring-[var(--obsidian-border)]"
            }`}
          >
            {/* Video or placeholder */}
            {run.videoUrl ? (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <p className="text-white/50 text-sm font-mono">[Video Player Placeholder: {run.videoUrl}]</p>
              </div>
            ) : run.screenshotUrl ? (
              <div className="absolute inset-0 bg-[var(--obsidian-surface)] flex items-center justify-center">
                <img src={run.screenshotUrl} alt="Failure screenshot" className="max-w-full max-h-full object-contain opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--obsidian)]/80 to-transparent" />
                <div className="absolute bottom-6 left-0 right-0 text-center">
                  <p className="text-[var(--status-error)] font-semibold mb-1">Execution Failed</p>
                  <p className="text-sm text-[var(--text-muted)] max-w-lg mx-auto">{run.failureReason}</p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-[var(--obsidian-surface)] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--obsidian-elevated)] to-[var(--obsidian-surface)] border border-[var(--obsidian-border)] flex items-center justify-center">
                    {(run.status === "RUNNING" || run.status === "QUEUED") ? (
                      <Loader2 className="h-8 w-8 text-[var(--cyan)] animate-spin" />
                    ) : (
                      <Play className="h-8 w-8 text-[var(--gold)] ml-1" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {run.status === "RUNNING" ? "Live Session Execution" : "Session Replay"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {run.status === "RUNNING" ? "Workflow is currently running on a worker node" : "No video available for this run"}
                  </p>
                </div>
              </div>
            )}

            {/* Event HUD overlay */}
            <div className="absolute top-3 left-3 z-10">
              <div className="glass px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[var(--cyan)] space-y-0.5">
                <div>Type: {activeStepData?.step?.type || "—"}</div>
                {activeStepData?.step?.selector && (
                  <div>Target: {activeStepData.step.selector.slice(0, 30)}{activeStepData.step.selector.length > 30 ? '...' : ''}</div>
                )}
                {activeStepData?.error && (
                  <div className="text-[var(--status-error)] mt-1">Err: {activeStepData.error.slice(0, 40)}...</div>
                )}
              </div>
            </div>

            <div className="absolute top-3 right-3 z-10">
              <StatusBadge status={run.status.toLowerCase() as RunStatus} />
            </div>

            {/* HITL takeover indicator */}
            {isHITLMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <div className="glass px-4 py-2 rounded-full flex items-center gap-2 glow-gold-border">
                  <Hand className="h-4 w-4 text-[var(--gold)]" />
                  <span className="text-sm font-medium text-[var(--gold)]">
                    Human Intervention Required
                  </span>
                  <GoldButton size="sm">Take Over Session</GoldButton>
                </div>
              </div>
            )}
          </div>

          {/* ── Timeline Bar ── */}
          <div className="mt-3 glass rounded-xl p-3 flex-shrink-0">
            {/* Progress bar */}
            <div className="relative h-2 bg-[var(--obsidian-surface)] rounded-full mb-3 cursor-pointer group">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold)]"
                style={{ width: `${totalTime > 0 ? (currentTime / totalTime) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[var(--gold)] border-2 border-[var(--obsidian)] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>

              {/* Step event markers */}
              {combinedSteps.map((s, i) => {
                const position = ((i + 1) / Math.max(combinedSteps.length, 1)) * 90 + 5;
                return (
                  <button
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all hover:scale-150 z-10"
                    style={{
                      left: `${position}%`,
                      backgroundColor: s.selfHealed
                        ? "var(--status-healed)"
                        : s.status === "COMPLETED"
                        ? "var(--status-success)"
                        : s.status === "FAILED"
                        ? "var(--status-error)"
                        : s.status === "RUNNING"
                        ? "var(--cyan)"
                        : "var(--obsidian-border)",
                    }}
                    onClick={() => {
                      setActiveStep(i);
                      setCurrentTime(Math.round((position / 100) * totalTime));
                    }}
                    title={`${s.step.type} (${s.status})`}
                  />
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)] transition-colors"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2.5 rounded-full bg-[var(--gold)] text-[var(--obsidian)] hover:brightness-110 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => setCurrentTime(Math.min(totalTime, currentTime + 10))}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)] transition-colors"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
                <span>{formatTime(currentTime)} / {formatTime(totalTime)}</span>
              </div>

              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
                  <Volume2 className="h-4 w-4" />
                </button>
                <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--obsidian-elevated)] transition-colors">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Step Log Sidebar ── */}
        <div className="w-[320px] border-l border-[var(--obsidian-border)] glass-heavy flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-[var(--obsidian-border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Step Timeline
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              {combinedSteps.length} steps • {formatDuration(run.durationMs)} total
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {combinedSteps.map((s, i) => {
              const Icon = getStepIcon(s.step.type);
              const isActive = i === activeStep;

              return (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--gold-subtle)] border border-[var(--gold)]/20"
                      : "hover:bg-[var(--obsidian-elevated)] border border-transparent"
                  }`}
                >
                  {/* Step number + icon */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive
                          ? "bg-[var(--gold)]/20"
                          : "bg-[var(--obsidian-surface)]"
                      }`}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{
                          color: isActive ? "var(--gold)" : "var(--text-muted)",
                        }}
                      />
                    </div>
                    {/* Status indicator */}
                    <div className="h-1.5 w-1.5 rounded-full mt-0.5" 
                      style={{
                        backgroundColor: s.selfHealed
                          ? "var(--status-healed)"
                          : s.status === "COMPLETED"
                          ? "var(--status-success)"
                          : s.status === "FAILED"
                          ? "var(--status-error)"
                          : s.status === "RUNNING"
                          ? "var(--cyan)"
                          : "transparent",
                        border: s.status === "pending" ? "1px solid var(--obsidian-border)" : "none"
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p
                        className={`text-xs font-medium truncate pr-2 ${
                          isActive
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {s.step.name || s.step.type}
                      </p>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                        {s.duration}
                      </span>
                    </div>

                    {/* Selector / Context */}
                    {s.step.selector && (
                      <p className="text-[10px] font-mono text-[var(--text-muted)] truncate mb-1.5 opacity-80">
                        {s.step.selector}
                      </p>
                    )}

                    {/* Self-healed state */}
                    {s.selfHealed && (
                      <div className="mt-1.5 p-1.5 rounded bg-[var(--status-healed)]/10 border border-[var(--status-healed)]/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Zap className="h-2.5 w-2.5 text-[var(--status-healed)]" />
                          <span className="text-[9px] font-semibold text-[var(--status-healed)] uppercase tracking-wider">
                            Self-Healed
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                          Element successfully re-targeted during execution.
                        </p>
                      </div>
                    )}
                    
                    {/* Error state */}
                    {s.error && (
                      <div className="mt-1.5 p-1.5 rounded bg-[var(--status-error)]/10 border border-[var(--status-error)]/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <XCircle className="h-2.5 w-2.5 text-[var(--status-error)]" />
                          <span className="text-[9px] font-semibold text-[var(--status-error)] uppercase tracking-wider">
                            Failed
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-tight break-words line-clamp-3">
                          {s.error}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            
            {combinedSteps.length === 0 && (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                No steps logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
