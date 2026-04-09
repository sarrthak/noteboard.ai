"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type OnConnect,
  Handle,
  Position,
} from "@xyflow/react";
// @ts-expect-error — CSS side-effect import has no type declarations
import "@xyflow/react/dist/style.css";
import {
  Database,
  Server,
  Circle,
  Diamond,
  SquareStack,
  Layers,
} from "lucide-react";

/* ---------- Custom tech node ---------- */

const shapeIcon: Record<string, React.ReactNode> = {
  database: <Database className="w-4 h-4 text-[#EFD30B]" />,
  service: <Server className="w-4 h-4 text-[#EFD30B]" />,
  circle: <Circle className="w-4 h-4 text-[#EFD30B]" />,
  decision: <Diamond className="w-4 h-4 text-[#EFD30B]" />,
  subroutine: <SquareStack className="w-4 h-4 text-[#EFD30B]" />,
  rounded: <Layers className="w-4 h-4 text-[#EFD30B]" />,
};

function TechNode({ data }: { data: { label: string; shape?: string } }) {
  const icon = shapeIcon[data.shape ?? "service"] ?? shapeIcon.service;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-[#EFD30B]" />
      <div
        className="flex items-center gap-2 rounded-lg border border-[#EFD30B]/30 bg-[#222221] px-4 py-2.5 shadow-[0_0_12px_rgba(239,211,11,0.08)] transition-shadow hover:shadow-[0_0_20px_rgba(239,211,11,0.15)]"
      >
        {icon}
        <span className="text-sm font-medium text-[#F9F8F4] whitespace-nowrap">
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#EFD30B]" />
    </>
  );
}

/* ---------- Canvas component ---------- */

interface ArchitectureCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
}

export function ArchitectureCanvas({
  initialNodes,
  initialEdges,
}: ArchitectureCanvasProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({ techNode: TechNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when parent passes new data
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#EFD30B" } }, eds)),
    [setEdges]
  );

  return (
    <div className="h-full w-full rounded-lg border border-foreground/10 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ animated: true, style: { stroke: "#EFD30B" } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#333" gap={20} />
        <Controls
          className="!bg-[#2A2A29] !border-foreground/10 !rounded-lg [&>button]:!bg-[#2A2A29] [&>button]:!border-foreground/10 [&>button]:!text-[#F9F8F4] [&>button:hover]:!bg-[#3A3A39]"
        />
        <MiniMap
          nodeColor="#EFD30B"
          maskColor="rgba(26,26,25,0.85)"
          className="!bg-[#222221] !border-foreground/10 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
