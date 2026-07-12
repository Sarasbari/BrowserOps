"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { TopBar } from "@/components/layout/TopBar";
import { GlassCard, GoldButton } from "@/components/ui";
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  Lock,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { fetchCredentials } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

export default function CredentialsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("username_password");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const { data, error, isLoading } = useSWR("/api/credentials", fetchCredentials);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, value }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create credential");
      }

      await mutate("/api/credentials");
      setShowAdd(false);
      setName("");
      setValue("");
      setType("username_password");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential? This action cannot be undone and may break workflows that rely on it.")) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/credentials/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete credential");
      }

      await mutate("/api/credentials");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  if (error) {
    return (
      <>
        <TopBar title="Credentials" subtitle="Error loading credentials" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-[var(--status-error)] mx-auto opacity-80" />
            <p className="text-[var(--status-error)]">Failed to load credentials.</p>
            <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </>
    );
  }

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
            Stored Credentials ({data?.credentials.length || 0})
          </h2>
          <GoldButton size="md" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            {showAdd ? "Cancel" : "Add Credential"}
          </GoldButton>
        </div>

        {/* Add credential form */}
        {showAdd && (
          <GlassCard className="p-5 mb-6" glow="gold" hover={false}>
            <h3 className="text-sm font-semibold text-[var(--gold)] mb-4">
              New Credential
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Shopify Admin"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Type
                </label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                >
                  <option value="username_password">Username + Password</option>
                  <option value="api_key">API Key</option>
                  <option value="oauth_token">OAuth Token</option>
                  <option value="cookie">Cookie</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Secret Value
                </label>
                <input
                  type="password"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter secret value..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--obsidian-surface)] border border-[var(--obsidian-border)] text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <GoldButton size="md" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Encrypt & Save
                </GoldButton>
                <GoldButton variant="ghost" size="md" type="button" onClick={() => setShowAdd(false)}>
                  Cancel
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
        {!isLoading && data && data.credentials.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--obsidian-surface)] mb-4">
              <KeyRound className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              No credentials found
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              You haven't added any credentials yet.
            </p>
          </div>
        )}

        {/* Credentials list */}
        {data && data.credentials.length > 0 && (
          <div className="space-y-3">
            {data.credentials.map((cred) => (
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
                        <span className="text-[10px] font-mono text-[var(--text-muted)] capitalize">
                          {cred.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          Created {new Date(cred.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Updated {formatRelativeTime(cred.updatedAt)}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--obsidian-surface)] px-2 py-1 rounded">
                      •••••••••
                    </span>
                    <button 
                      className="p-2 rounded-lg text-[var(--status-error)] opacity-80 hover:bg-[var(--obsidian-elevated)] hover:opacity-100 transition-colors disabled:opacity-50"
                      onClick={() => handleDelete(cred.id)}
                      disabled={isDeleting === cred.id}
                    >
                      {isDeleting === cred.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
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
