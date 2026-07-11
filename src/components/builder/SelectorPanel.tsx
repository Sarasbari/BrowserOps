"use client";

import { useState } from "react";
import {
  Shield,
  Crosshair,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

interface SelectorVector {
  primary: string;
  css?: string;
  text?: string;
  testId?: string;
  ariaLabel?: string;
}

interface SelectorPanelProps {
  selectors: SelectorVector;
  onChange: (selectors: SelectorVector) => void;
  htmlSnippet?: string;
  elementDescription?: string;
}

const STRATEGIES = [
  {
    key: "primary" as const,
    label: "Primary Selector",
    placeholder: "#submit-btn, [data-testid='submit']",
    description: "The primary CSS / ID selector",
    color: "var(--gold)",
  },
  {
    key: "css" as const,
    label: "CSS Fallback",
    placeholder: "form > button.submit-btn",
    description: "Generalized CSS path as fallback",
    color: "var(--cyan)",
  },
  {
    key: "text" as const,
    label: "Text Content",
    placeholder: "Submit Order",
    description: "Visible text for text-based matching",
    color: "#A78BFA",
  },
  {
    key: "testId" as const,
    label: "Test ID",
    placeholder: "submit-order",
    description: "data-testid attribute value",
    color: "#22C55E",
  },
  {
    key: "ariaLabel" as const,
    label: "ARIA Label",
    placeholder: "Submit your order",
    description: "aria-label for accessibility matching",
    color: "#F59E0B",
  },
];

export function SelectorPanel({
  selectors,
  onChange,
  htmlSnippet,
  elementDescription,
}: SelectorPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filledCount = Object.values(selectors).filter(Boolean).length;
  const totalCount = STRATEGIES.length;

  const handleChange = (key: keyof SelectorVector, value: string) => {
    onChange({ ...selectors, [key]: value || undefined });
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleAiSuggest = async () => {
    if (!htmlSnippet || !elementDescription) return;
    setIsAiLoading(true);

    try {
      const res = await fetch("/api/selectors/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlSnippet,
          targetElementDescription: elementDescription,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.selectors) {
          onChange({
            primary: data.selectors.primary || selectors.primary,
            css: data.selectors.css || selectors.css,
            text: data.selectors.text || selectors.text,
            testId: data.selectors.testId || selectors.testId,
            ariaLabel: data.selectors.ariaLabel || selectors.ariaLabel,
          });
        }
      }
    } catch (err) {
      console.error("AI selector suggestion failed:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--obsidian-border)] bg-[var(--obsidian-surface)]/60 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--obsidian-elevated)]/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-[var(--gold)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Multi-Vector Selectors
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-[var(--gold)]/10 text-[var(--gold)]">
            {filledCount}/{totalCount}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Healing strength indicator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--obsidian)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(filledCount / totalCount) * 100}%`,
                  background:
                    filledCount <= 1
                      ? "#EF4444"
                      : filledCount <= 3
                      ? "#F59E0B"
                      : "#22C55E",
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">
              {filledCount <= 1
                ? "Fragile"
                : filledCount <= 3
                ? "Moderate"
                : "Resilient"}
            </span>
          </div>

          {/* AI Suggestion button */}
          {htmlSnippet && elementDescription && (
            <button
              onClick={handleAiSuggest}
              disabled={isAiLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--cyan)]/30 bg-[var(--cyan)]/5 hover:bg-[var(--cyan)]/10 text-[var(--cyan)] text-xs font-medium transition-all disabled:opacity-50"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isAiLoading ? "AI Analyzing..." : "Auto-Suggest with AI"}
            </button>
          )}

          {/* Selector inputs */}
          {STRATEGIES.map((strategy) => (
            <div key={strategy.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: selectors[strategy.key]
                        ? strategy.color
                        : "var(--text-muted)",
                    }}
                  />
                  <label className="text-[10px] font-semibold text-[var(--text-secondary)]">
                    {strategy.label}
                  </label>
                </div>
                {selectors[strategy.key] && (
                  <button
                    onClick={() =>
                      handleCopy(strategy.key, selectors[strategy.key]!)
                    }
                    className="p-0.5 rounded hover:bg-[var(--obsidian-elevated)] transition-colors"
                  >
                    {copiedKey === strategy.key ? (
                      <Check className="w-2.5 h-2.5 text-[#22C55E]" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                    )}
                  </button>
                )}
              </div>
              <div className="relative">
                <Crosshair
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
                  style={{
                    color: selectors[strategy.key]
                      ? strategy.color
                      : "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  value={selectors[strategy.key] || ""}
                  onChange={(e) => handleChange(strategy.key, e.target.value)}
                  placeholder={strategy.placeholder}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[var(--obsidian)] border border-[var(--obsidian-border)] text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none focus:border-[var(--gold)]/50 focus:ring-1 focus:ring-[var(--gold)]/20 transition-all"
                />
              </div>
              <p className="text-[9px] text-[var(--text-muted)] pl-1">
                {strategy.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
