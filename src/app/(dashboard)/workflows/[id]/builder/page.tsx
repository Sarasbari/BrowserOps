"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TopBar } from "@/components/layout/TopBar";
import { StepNode } from "@/components/builder/StepNode";
import { StepPalette } from "@/components/builder/StepPalette";
import { GoldButton } from "@/components/ui";
import { Save, Upload, Play, Undo2, Redo2, Loader2 } from "lucide-react";
import type { StepType } from "@/lib/design-tokens";

// ── Edge styling ──
const EDGE_STYLE = { stroke: "#00F5FF", strokeWidth: 2 };

// ── Serialization: React Flow nodes → WorkflowStep[] ──
function serializeCanvas(
  nodes: Node[],
  edges: Edge[]
): { type: string; label: string; config: Record<string, unknown> }[] {
  // Build adjacency list to topologically sort nodes
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }
  // Include any unconnected nodes at the end
  for (const n of nodes) {
    if (!sorted.includes(n.id)) sorted.push(n.id);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sorted.map((id) => {
    const node = nodeMap.get(id)!;
    const d = node.data as Record<string, unknown>;
    return {
      type: (d.stepType as string) || "open_url",
      label: (d.label as string) || "Untitled Step",
      config: (d.config as Record<string, unknown>) || {},
    };
  });
}

// ── Deserialization: WorkflowStep[] → React Flow nodes + edges ──
function deserializeSteps(
  steps: { type: string; label: string; config: Record<string, unknown> }[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((step, i) => ({
    id: `step-${i + 1}`,
    type: "stepNode",
    position: { x: 100, y: 100 + i * 180 },
    data: {
      stepType: step.type as StepType,
      label: step.label,
      config: step.config,
    },
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      animated: true,
      style: EDGE_STYLE,
    });
  }

  return { nodes, edges };
}

// ── Status Toast ──
type ToastType = "success" | "error" | "loading";
interface Toast {
  message: string;
  type: ToastType;
}

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  const workflowId = params.id;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("DRAFT");
  const [versionNum, setVersionNum] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  // ── Show toast ──
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    if (type !== "loading") {
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ stepNode: StepNode }),
    []
  );

  // ── Load workflow data ──
  useEffect(() => {
    if (!workflowId || workflowId === "new") {
      setLoading(false);
      return;
    }

    async function loadWorkflow() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) throw new Error("Failed to load workflow");

        const { workflow } = await res.json();
        setWorkflowName(workflow.name);
        setWorkflowStatus(workflow.status);

        // Determine which steps to load
        let steps: { type: string; label: string; config: Record<string, unknown> }[] | null = null;

        // Prefer draftSteps if available
        if (workflow.draftSteps && Array.isArray(workflow.draftSteps) && workflow.draftSteps.length > 0) {
          steps = workflow.draftSteps;
        } else if (workflow.versions && workflow.versions.length > 0) {
          // Use latest version
          const latestVersion = workflow.versions[0];
          setVersionNum(latestVersion.version);
          if (Array.isArray(latestVersion.steps) && latestVersion.steps.length > 0) {
            steps = latestVersion.steps;
          }
        }

        if (steps && steps.length > 0) {
          const { nodes: loadedNodes, edges: loadedEdges } = deserializeSteps(steps);
          setNodes(loadedNodes);
          setEdges(loadedEdges);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to load workflow", "error");
      } finally {
        setLoading(false);
      }
    }

    loadWorkflow();
  }, [workflowId, setNodes, setEdges, showToast]);

  // ── Connect nodes ──
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: EDGE_STYLE,
          },
          eds
        )
      ),
    [setEdges]
  );

  // ── Add node from palette ──
  const addNode = useCallback(
    (stepType: StepType) => {
      const newId = `step-${nodes.length + 1}`;
      const lastNode = nodes[nodes.length - 1];
      const newNode: Node = {
        id: newId,
        type: "stepNode",
        position: {
          x: lastNode ? lastNode.position.x : 100,
          y: lastNode ? lastNode.position.y + 180 : 100,
        },
        data: {
          stepType,
          label: `New ${stepType.replace(/_/g, " ")}`,
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Auto-connect to last node
      if (lastNode) {
        setEdges((eds) =>
          addEdge(
            {
              id: `e${lastNode.id}-${newId}`,
              source: lastNode.id,
              target: newId,
              animated: true,
              style: EDGE_STYLE,
            },
            eds
          )
        );
      }
    },
    [nodes, setNodes, setEdges]
  );

  // ── Save Draft ──
  const handleSaveDraft = useCallback(async () => {
    if (!workflowId || workflowId === "new") return;
    setSaving(true);
    showToast("Saving draft...", "loading");

    try {
      const steps = serializeCanvas(nodes, edges);
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftSteps: steps }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to save draft");
      }

      showToast("Draft saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [workflowId, nodes, edges, showToast]);

  // ── Publish Version ──
  const handlePublish = useCallback(async () => {
    if (!workflowId || workflowId === "new") return;
    setPublishing(true);
    showToast("Publishing version...", "loading");

    try {
      const steps = serializeCanvas(nodes, edges);
      const res = await fetch(`/api/workflows/${workflowId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps,
          changelog: `Published from builder`,
        }),
      });

      if (!res.ok) {
        const { error, details } = await res.json();
        throw new Error(details || error || "Failed to publish");
      }

      const { version } = await res.json();
      setVersionNum(version.version);
      setWorkflowStatus("PUBLISHED");
      showToast(`Published v${version.version}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Publish failed", "error");
    } finally {
      setPublishing(false);
    }
  }, [workflowId, nodes, edges, showToast]);

  // ── Test Run ──
  const handleTestRun = useCallback(async () => {
    if (!workflowId || workflowId === "new") return;
    setTesting(true);
    showToast("Starting test run...", "loading");

    try {
      // Save draft first so the version has latest steps
      const steps = serializeCanvas(nodes, edges);
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftSteps: steps }),
      });

      // Trigger run with testRun flag
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, testRun: true }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to start test run");
      }

      showToast("Test run queued", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Test run failed", "error");
    } finally {
      setTesting(false);
    }
  }, [workflowId, nodes, edges, showToast]);

  // ── Loading state ──
  if (loading) {
    return (
      <>
        <TopBar title="Workflow Architect" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[var(--gold)] animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Workflow Architect"
        subtitle={`${workflowName || "Untitled"} — ${workflowStatus} v${versionNum || "draft"}`}
      />

      <div className="flex-1 relative">
        {/* Step Palette */}
        <StepPalette
          isOpen={paletteOpen}
          onToggle={() => setPaletteOpen(!paletteOpen)}
          onAddStep={addNode}
        />

        {/* React Flow Canvas */}
        <div className="w-full h-[calc(100vh-64px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              animated: true,
              style: EDGE_STYLE,
            }}
            style={{ background: "transparent" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(255, 255, 255, 0.04)"
            />
            <Controls
              className="!bg-[var(--smoke)] !border-[var(--obsidian-border)] !rounded-lg [&>button]:!bg-[var(--obsidian-surface)] [&>button]:!border-[var(--obsidian-border)] [&>button]:!text-[var(--text-secondary)] [&>button:hover]:!bg-[var(--obsidian-elevated)]"
            />
            <MiniMap
              nodeColor="#D4AF37"
              maskColor="rgba(10, 10, 11, 0.85)"
              className="!bg-[var(--obsidian-surface)] !border-[var(--obsidian-border)] !rounded-lg"
            />

            {/* Toolbar Panel */}
            <Panel position="top-right" className="flex items-center gap-2">
              <GoldButton variant="ghost" size="sm">
                <Undo2 className="h-3.5 w-3.5" />
              </GoldButton>
              <GoldButton variant="ghost" size="sm">
                <Redo2 className="h-3.5 w-3.5" />
              </GoldButton>
              <div className="w-px h-6 bg-[var(--obsidian-border)]" />
              <GoldButton
                variant="secondary"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Draft
              </GoldButton>
              <GoldButton
                variant="primary"
                size="sm"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Publish
              </GoldButton>
              <GoldButton
                variant="secondary"
                size="sm"
                onClick={handleTestRun}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Test Run
              </GoldButton>
            </Panel>

            {/* Toast */}
            {toast && (
              <Panel position="bottom-center">
                <div
                  className={`px-4 py-2 rounded-lg text-xs font-medium backdrop-blur-md border ${
                    toast.type === "success"
                      ? "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20"
                      : toast.type === "error"
                      ? "bg-[var(--status-error)]/10 text-[var(--status-error)] border-[var(--status-error)]/20"
                      : "bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]/20"
                  }`}
                >
                  {toast.type === "loading" && (
                    <Loader2 className="h-3 w-3 animate-spin inline mr-2" />
                  )}
                  {toast.message}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </>
  );
}
