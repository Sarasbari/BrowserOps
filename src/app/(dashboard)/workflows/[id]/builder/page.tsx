"use client";

import React, { useCallback, useMemo, useState } from "react";
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
import { Save, Upload, Play, Undo2, Redo2 } from "lucide-react";
import type { StepType } from "@/lib/design-tokens";

// Initial demo workflow
const initialNodes: Node[] = [
  {
    id: "step-1",
    type: "stepNode",
    position: { x: 100, y: 100 },
    data: {
      stepType: "open_url" as StepType,
      label: "Navigate to Portal",
      config: { url: "https://portal.example.com/login" },
    },
  },
  {
    id: "step-2",
    type: "stepNode",
    position: { x: 100, y: 280 },
    data: {
      stepType: "type_text" as StepType,
      label: "Enter Username",
      config: { selector: "#username", value: "{{credentials.username}}" },
    },
  },
  {
    id: "step-3",
    type: "stepNode",
    position: { x: 100, y: 460 },
    data: {
      stepType: "type_text" as StepType,
      label: "Enter Password",
      config: { selector: "#password", value: "{{credentials.password}}" },
    },
  },
  {
    id: "step-4",
    type: "stepNode",
    position: { x: 100, y: 640 },
    data: {
      stepType: "click_element" as StepType,
      label: "Click Login Button",
      config: {
        selectors: {
          primary: "#login-btn",
          text: "Sign In",
          css: "form.login > button[type=submit]",
          ariaLabel: "Sign in to your account",
        },
      },
    },
  },
  {
    id: "step-5",
    type: "stepNode",
    position: { x: 100, y: 820 },
    data: {
      stepType: "wait_for_selector" as StepType,
      label: "Wait for Dashboard",
      config: { selector: ".dashboard-container", timeout: 10000 },
    },
  },
  {
    id: "step-6",
    type: "stepNode",
    position: { x: 100, y: 1000 },
    data: {
      stepType: "extract_table" as StepType,
      label: "Extract Sales Report",
      config: { selector: "table.sales-data", outputKey: "salesReport" },
    },
  },
  {
    id: "step-7",
    type: "stepNode",
    position: { x: 100, y: 1180 },
    data: {
      stepType: "save_output" as StepType,
      label: "Save Report Data",
      config: { format: "csv", filename: "sales-report-{{date}}.csv" },
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "step-1", target: "step-2", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
  { id: "e2-3", source: "step-2", target: "step-3", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
  { id: "e3-4", source: "step-3", target: "step-4", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
  { id: "e4-5", source: "step-4", target: "step-5", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
  { id: "e5-6", source: "step-5", target: "step-6", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
  { id: "e6-7", source: "step-6", target: "step-7", animated: true, style: { stroke: "#00F5FF", strokeWidth: 2 } },
];

export default function WorkflowBuilderPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [paletteOpen, setPaletteOpen] = useState(true);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ stepNode: StepNode }),
    []
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#00F5FF", strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

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
              style: { stroke: "#00F5FF", strokeWidth: 2 },
            },
            eds
          )
        );
      }
    },
    [nodes, setNodes, setEdges]
  );

  return (
    <>
      <TopBar
        title="Workflow Architect"
        subtitle="Download Shopify Report — Draft v3"
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
              style: { stroke: "#00F5FF", strokeWidth: 2 },
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
              <GoldButton variant="secondary" size="sm">
                <Save className="h-3.5 w-3.5" />
                Save Draft
              </GoldButton>
              <GoldButton variant="primary" size="sm">
                <Upload className="h-3.5 w-3.5" />
                Publish
              </GoldButton>
              <GoldButton variant="secondary" size="sm">
                <Play className="h-3.5 w-3.5" />
                Test Run
              </GoldButton>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </>
  );
}
