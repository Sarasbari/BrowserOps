"use client";

import React, { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton, StatusBadge, CyanBadge } from "@/components/ui";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Volume2,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Hand,
  Eye,
  Globe,
  MousePointerClick,
  Keyboard,
  FileText,
  Table,
  Save,
  ChevronRight,
} from "lucide-react";
import type { RunStatus } from "@/lib/design-tokens";

// Mock run data
const mockRun = {
  id: "run-3",
  workflow: "Scrape Competitor Pricing",
  version: 2,
  status: "completed" as RunStatus,
  startedAt: "2024-12-15T10:23:00Z",
  completedAt: "2024-12-15T10:28:02Z",
  duration: "5m 02s",
  browserMinutes: 5.03,
  selfHealed: true,
  videoUrl: "/demo-video.webm",
};

const mockStepLogs: Array<{ index: number; type: string; label: string; status: "completed" | "failed" | "running"; duration: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; selfHealed: boolean; healedFrom?: string; healedTo?: string }> = [
  { index: 0, type: "open_url", label: "Navigate to Portal", status: "completed", duration: "1.2s", icon: Globe, selfHealed: false },
  { index: 1, type: "type_text", label: "Enter Credentials", status: "completed", duration: "0.8s", icon: Keyboard, selfHealed: false },
  { index: 2, type: "click_element", label: "Click Login", status: "completed", duration: "0.4s", icon: MousePointerClick, selfHealed: true, healedFrom: "#login-btn", healedTo: "text:Sign In" },
  { index: 3, type: "wait_for_selector", label: "Wait for Dashboard", status: "completed", duration: "3.1s", icon: Clock, selfHealed: false },
  { index: 4, type: "extract_table", label: "Extract Pricing Data", status: "completed", duration: "2.5s", icon: Table, selfHealed: false },
  { index: 5, type: "save_output", label: "Save Results", status: "completed", duration: "0.6s", icon: Save, selfHealed: false },
];

export default function TheaterPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(45);
  const [totalTime] = useState(302);
  const [activeStep, setActiveStep] = useState(2);
  const [isHITLMode] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <TopBar
        title="Theater"
        subtitle={`${mockRun.workflow} — Run #${mockRun.id}`}
      />

      <div className="flex-1 flex">
        {/* ── Main Viewport ── */}
        <div className="flex-1 flex flex-col p-4">
          {/* Video viewport with gold frame */}
          <div
            className={`flex-1 relative rounded-xl overflow-hidden ${
              isHITLMode
                ? "animate-pulse-gold ring-2 ring-[var(--gold)]"
                : "ring-1 ring-[var(--obsidian-border)]"
            }`}
          >
            {/* Video placeholder */}
            <div className="absolute inset-0 bg-[var(--obsidian-surface)] flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--obsidian-elevated)] to-[var(--obsidian-surface)] border border-[var(--obsidian-border)] flex items-center justify-center">
                  <Play className="h-8 w-8 text-[var(--gold)] ml-1" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Session Replay
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Click play to watch the browser session recording
                </p>
              </div>
            </div>

            {/* Event HUD overlay */}
            <div className="absolute top-3 left-3 z-10">
              <div className="glass px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[var(--cyan)] space-y-0.5">
                <div>Selector: {mockStepLogs[activeStep]?.type === "click_element" ? "#login-btn → text:Sign In" : "—"}</div>
                <div>Network: 42ms latency</div>
                <div>Memory: 128MB</div>
              </div>
            </div>

            <div className="absolute top-3 right-3 z-10">
              <StatusBadge status={mockRun.status} />
            </div>

            {/* HITL takeover indicator */}
            {isHITLMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <div className="glass px-4 py-2 rounded-full flex items-center gap-2 glow-gold-border">
                  <Hand className="h-4 w-4 text-[var(--gold)]" />
                  <span className="text-sm font-medium text-[var(--gold)]">
                    You are in control
                  </span>
                  <GoldButton size="sm">Resume Workflow</GoldButton>
                </div>
              </div>
            )}
          </div>

          {/* ── Timeline Bar ── */}
          <div className="mt-3 glass rounded-xl p-3">
            {/* Progress bar */}
            <div className="relative h-2 bg-[var(--obsidian-surface)] rounded-full mb-3 cursor-pointer group">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold)]"
                style={{ width: `${(currentTime / totalTime) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[var(--gold)] border-2 border-[var(--obsidian)] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>

              {/* Step event markers */}
              {mockStepLogs.map((step, i) => {
                const position = ((i + 1) / mockStepLogs.length) * 90 + 5;
                return (
                  <button
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all hover:scale-150 z-10"
                    style={{
                      left: `${position}%`,
                      backgroundColor: step.selfHealed
                        ? "var(--status-healed)"
                        : step.status === "completed"
                        ? "var(--status-success)"
                        : "var(--status-error)",
                    }}
                    onClick={() => {
                      setActiveStep(i);
                      setCurrentTime(Math.round((position / 100) * totalTime));
                    }}
                    title={step.label}
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
                <select className="bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] rounded px-1.5 py-0.5 text-[var(--text-secondary)] text-xs">
                  <option>1x</option>
                  <option>1.5x</option>
                  <option>2x</option>
                  <option>0.5x</option>
                </select>
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
        <div className="w-[320px] border-l border-[var(--obsidian-border)] glass-heavy flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--obsidian-border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Step Timeline
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              {mockStepLogs.length} steps • {mockRun.duration} total
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mockStepLogs.map((step, i) => {
              const Icon = step.icon;
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
                    {i < mockStepLogs.length - 1 && (
                      <div className="w-px h-4 bg-[var(--obsidian-border)]" />
                    )}
                  </div>

                  {/* Step details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs font-medium truncate ${
                          isActive
                            ? "text-[var(--gold)]"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {step.label}
                      </p>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                        {step.duration}
                      </span>
                    </div>

                    {/* Self-healed indicator */}
                    {step.selfHealed && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--status-healed)] font-mono">
                        <Zap className="h-2.5 w-2.5" />
                        Self-healed: {step.healedFrom} → {step.healedTo}
                      </div>
                    )}

                    {/* Status icon */}
                    <div className="flex items-center gap-1 mt-1">
                      {step.status === "completed" && (
                        <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                      )}
                      {step.status === "failed" && (
                        <XCircle className="h-3 w-3 text-[var(--status-error)]" />
                      )}
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Step {i + 1}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Run summary */}
          <div className="p-3 border-t border-[var(--obsidian-border)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Browser Minutes</span>
              <span className="font-mono text-[var(--gold)]">
                {mockRun.browserMinutes} min
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Self-healed</span>
              <CyanBadge>
                <Zap className="h-2.5 w-2.5" />1 step
              </CyanBadge>
            </div>
            <GoldButton variant="secondary" size="sm" className="w-full mt-2">
              <Eye className="h-3.5 w-3.5" />
              View Full Logs
            </GoldButton>
          </div>
        </div>
      </div>
    </>
  );
}
