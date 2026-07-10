"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { stepTypeConfig, type StepType } from "@/lib/design-tokens";
import {
  Globe,
  MousePointerClick,
  Keyboard,
  Clock,
  FileText,
  Table,
  Download,
  Upload,
  Save,
  Hand,
  ChevronLeft,
  Plus,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Globe,
  MousePointerClick,
  Keyboard,
  Clock,
  FileText,
  Table,
  Download,
  Upload,
  Save,
  Hand,
};

interface StepPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddStep: (stepType: StepType) => void;
}

const stepTypes = Object.entries(stepTypeConfig) as [
  StepType,
  (typeof stepTypeConfig)[StepType]
][];

export function StepPalette({ isOpen, onToggle, onAddStep }: StepPaletteProps) {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 z-20 h-full",
        "transition-all duration-300 ease-out",
        isOpen ? "w-[260px]" : "w-[44px]"
      )}
    >
      <div className="h-full glass-heavy border-r border-[var(--obsidian-border)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-12 border-b border-[var(--obsidian-border)]">
          {isOpen && (
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Step Types
            </span>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-[var(--obsidian-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                !isOpen && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Step list */}
        {isOpen && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {stepTypes.map(([type, config]) => {
              const Icon = iconMap[config.icon] || Globe;

              return (
                <button
                  key={type}
                  onClick={() => onAddStep(type)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left",
                    "transition-all duration-200",
                    "hover:bg-[var(--obsidian-elevated)] group",
                    "border border-transparent hover:border-[var(--obsidian-border)]"
                  )}
                >
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: config.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {config.label}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      {config.description}
                    </p>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}

        {/* Collapsed state - just icons */}
        {!isOpen && (
          <div className="flex-1 overflow-y-auto p-1 space-y-1">
            {stepTypes.map(([type, config]) => {
              const Icon = iconMap[config.icon] || Globe;
              return (
                <button
                  key={type}
                  onClick={() => onAddStep(type)}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg hover:bg-[var(--obsidian-elevated)] transition-colors"
                  title={config.label}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: config.color }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
