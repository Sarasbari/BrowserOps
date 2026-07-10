"use client";

import React from "react";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton } from "@/components/ui";
import { User, Bell, Shield, CreditCard, Palette } from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Manage your account and preferences" />
      <div className="flex-1 p-6 space-y-6">
        {/* Profile */}
        <GlassCard className="p-5" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--gold-subtle)]">
              <User className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Profile
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Manage your profile settings via Clerk. Click the avatar in the top-right corner.
          </p>
        </GlassCard>

        {/* Notifications */}
        <GlassCard className="p-5" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--cyan-subtle)]">
              <Bell className="h-4 w-4 text-[var(--cyan)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Notifications
            </h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "HITL intervention alerts", desc: "Get notified when a workflow needs your attention" },
              { label: "Run failure alerts", desc: "Get notified when a workflow run fails" },
              { label: "Self-healing events", desc: "Get notified when a workflow self-heals" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-[var(--obsidian-surface)]">
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{item.label}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-9 h-5 bg-[var(--obsidian-border)] peer-focus:outline-none rounded-full peer peer-checked:bg-[var(--gold)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Plan */}
        <GlassCard className="p-5" glow="gold" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--gold-subtle)]">
              <CreditCard className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Plan & Billing
            </h3>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--obsidian-surface)]">
            <div>
              <p className="text-sm font-medium text-[var(--gold)]">Free Plan</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                500 browser minutes / month • 3 scheduled workflows
              </p>
            </div>
            <GoldButton size="sm">Upgrade to Pro</GoldButton>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
