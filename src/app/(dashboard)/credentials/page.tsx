"use client";

import React, { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton } from "@/components/ui";
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ShieldCheck,
  Lock,
  Calendar,
} from "lucide-react";

const mockCredentials = [
  { id: "cred-1", name: "Shopify Admin", type: "username_password", createdAt: "2024-12-01", lastUsed: "12 min ago", usedBy: 2 },
  { id: "cred-2", name: "CRM API Key", type: "api_key", createdAt: "2024-11-15", lastUsed: "1h ago", usedBy: 1 },
  { id: "cred-3", name: "Supplier Portal", type: "username_password", createdAt: "2024-10-20", lastUsed: "38 min ago", usedBy: 1 },
];

export default function CredentialsPage() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <TopBar title="Credentials" subtitle="Securely stored with AES-256-GCM encryption" />

      <div className="flex-1 p-6">
        {/* Security notice */}
        <GlassCard className="p-4 mb-6 flex items-center gap-3" glow="cyan" hover={false}>
          <div className="p-2 rounded-lg bg-[var(--cyan-subtle)]">
            <ShieldCheck className="h-4 w-4 text-[var(--cyan)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-[var(--text-primary)]">
              All credentials are encrypted at rest using <span className="font-mono text-[var(--cyan)]">AES-256-GCM</span> with per-credential unique keys.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Secret values are never displayed after creation. Only masked previews are shown.
            </p>
          </div>
        </GlassCard>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Stored Credentials ({mockCredentials.length})
          </h2>
          <GoldButton size="md" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            Add Credential
          </GoldButton>
        </div>

        {/* Add credential form */}
        {showAdd && (
          <GlassCard className="p-5 mb-6" glow="gold" hover={false}>
            <h3 className="text-sm font-semibold text-[var(--gold)] mb-4">
              New Credential
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Shopify Admin"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Type
                </label>
                <select className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none">
                  <option>Username + Password</option>
                  <option>API Key</option>
                  <option>OAuth Token</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Secret Value
                </label>
                <input
                  type="password"
                  placeholder="Enter secret value..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <GoldButton size="md">
                  <Lock className="h-3.5 w-3.5" />
                  Encrypt & Save
                </GoldButton>
                <GoldButton variant="ghost" size="md" onClick={() => setShowAdd(false)}>
                  Cancel
                </GoldButton>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Credentials list */}
        <div className="space-y-3">
          {mockCredentials.map((cred) => (
            <GlassCard key={cred.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--gold-subtle)]">
                    <KeyRound className="h-4 w-4 text-[var(--gold)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {cred.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {cred.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        Created {cred.createdAt}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Used by {cred.usedBy} workflow{cred.usedBy > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Last used: {cred.lastUsed}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--obsidian-surface)] px-2 py-1 rounded">
                    •••••••••
                  </span>
                  <GoldButton variant="ghost" size="sm">
                    <Trash2 className="h-3.5 w-3.5 text-[var(--status-error)]" />
                  </GoldButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
