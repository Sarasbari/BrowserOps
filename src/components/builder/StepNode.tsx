"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
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

interface StepNodeData {
  stepType: StepType;
  label: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

function StepNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const config = stepTypeConfig[nodeData.stepType];
  const Icon = iconMap[config.icon] || Globe;

  // Build a config snippet for display
  const configSnippet = Object.entries(nodeData.config || {})
    .slice(0, 3)
    .map(([key, val]) => {
      const displayVal =
        typeof val === "string"
          ? val.length > 30
            ? val.substring(0, 30) + "..."
            : val
          : typeof val === "object"
          ? JSON.stringify(val).substring(0, 30) + "..."
          : String(val);
      return `${key}: ${displayVal}`;
    })
    .join("\n");

  return (
    <div
      className={cn(
        "relative w-[280px] rounded-xl overflow-hidden",
        "glass border transition-all duration-300",
        selected
          ? "border-[var(--gold)] shadow-[var(--shadow-gold)]"
          : "border-[var(--obsidian-border)] hover:border-[var(--gold)]/40"
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[var(--cyan)] !border-2 !border-[var(--obsidian)] !rounded-full"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--obsidian-border)]"
        style={{
          background: `linear-gradient(135deg, ${config.color}10, transparent)`,
        }}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {nodeData.label as string}
          </p>
          <p
            className="text-[10px] font-medium"
            style={{ color: config.color }}
          >
            {config.label}
          </p>
        </div>
      </div>

      {/* Config snippet */}
      {configSnippet && (
        <div className="px-3.5 py-2.5">
          <pre className="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
            {configSnippet}
          </pre>
        </div>
      )}

      {/* Multi-vector selector indicator */}
      {nodeData.config &&
        !!(nodeData.config as Record<string, unknown>).selectors && (
          <div className="px-3.5 pb-2.5">
            <div className="flex items-center gap-1 text-[10px] text-[var(--cyan)] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)]" />
              Multi-vector selector
            </div>
          </div>
        )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[var(--gold)] !border-2 !border-[var(--obsidian)] !rounded-full"
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StepNode = memo(StepNodeComponent) as any;
