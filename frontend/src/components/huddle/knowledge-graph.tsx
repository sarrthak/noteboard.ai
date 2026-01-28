"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useHuddleStore, GraphData as StoreGraphData } from "@/store/useHuddleStore";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  ),
});

interface GraphNode {
  id: string;
  name: string;
  group: string;
  description?: string;
  business_value?: string;
  type?: string;
  ticket_id?: string;
  // Force graph properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  projectId?: string;
  onClose?: () => void;
}

// Color mapping for relationship types
const LINK_COLORS: Record<string, string> = {
  DEPENDS_ON: "#ef4444", // red
  ENABLES: "#22c55e",    // green
  EXTENDS: "#3b82f6",    // blue
  RELATED_TO: "#a855f7", // purple
};

// Color mapping for node types
const NODE_COLORS: Record<string, string> = {
  feature: "#EFD30B",    // gold/primary
  bug: "#ef4444",        // red
  task: "#3b82f6",       // blue
  project: "#F9F8F4",    // foreground
};

export function KnowledgeGraph({ projectId, onClose }: KnowledgeGraphProps) {
  const { data: session } = useSession();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get graph data from store (local capabilities)
  const { graphData: storeGraphData, setGraphData: setStoreGraphData } = useHuddleStore();
  
  const [apiGraphData, setApiGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Merge store data with API data (store data takes precedence for new items)
  const graphData = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const linkSet = new Set<string>();
    const links: GraphLink[] = [];

    // Add API nodes first
    for (const node of apiGraphData.nodes) {
      nodeMap.set(node.id, node);
    }

    // Add/update with store nodes (these are the freshly added ones)
    for (const node of storeGraphData.nodes) {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node as GraphNode);
      }
    }

    // Add API links
    for (const link of apiGraphData.links) {
      const key = `${typeof link.source === 'string' ? link.source : link.source.id}-${typeof link.target === 'string' ? link.target : link.target.id}-${link.type}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push(link);
      }
    }

    // Add store links
    for (const link of storeGraphData.links) {
      const key = `${link.source}-${link.target}-${link.type}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push(link as GraphLink);
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      links,
    };
  }, [apiGraphData, storeGraphData]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Fetch graph data from API
  const fetchGraph = useCallback(async () => {
    if (!projectId || !session?.accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/huddle/graph/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch graph");
      }

      const data = await response.json();
      setApiGraphData(data);
      
      // Also update store with API data to keep in sync
      setStoreGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session?.accessToken, setStoreGraphData]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Zoom controls
  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 400);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  // Node paint function
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = Math.max(12 / globalScale, 4);
    const nodeRadius = node.group === "project" ? 12 : 8;
    const color = NODE_COLORS[node.type || "feature"] || NODE_COLORS.feature;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = "#1A1A19";
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Draw label
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#F9F8F4";
    ctx.fillText(label, node.x || 0, (node.y || 0) + nodeRadius + 2);
  }, []);

  // Link paint function
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const source = link.source as GraphNode;
    const target = link.target as GraphNode;
    
    if (!source.x || !source.y || !target.x || !target.y) return;

    const color = LINK_COLORS[link.type] || "#666";
    const isRelatedTo = link.type === "RELATED_TO";
    
    // Draw line (dashed for RELATED_TO, solid for others)
    ctx.beginPath();
    if (isRelatedTo) {
      ctx.setLineDash([4 / globalScale, 2 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = (isRelatedTo ? 1.5 : 2) / globalScale;
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw arrow (smaller for RELATED_TO since it's bidirectional)
    if (!isRelatedTo) {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLength = 8 / globalScale;
      const arrowX = target.x - Math.cos(angle) * 12;
      const arrowY = target.y - Math.sin(angle) * 12;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, []);

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a project to view the knowledge graph
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full bg-background relative">
      {/* Floating Controls */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-muted/90 rounded-sm p-1 border border-foreground/10">
        <span className="text-xs text-muted-foreground px-2">
          {graphData.nodes.length} nodes
        </span>
        <div className="w-px h-4 bg-foreground/10" />
        <button
          onClick={fetchGraph}
          disabled={isLoading}
          className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitView}
          className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Fit View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Graph Content */}
      {isLoading && graphData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center text-destructive">
          {error}
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          <p className="text-sm">No capabilities yet</p>
          <p className="text-xs mt-1">Approve tickets to build the graph</p>
        </div>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#1A1A19"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, 12, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          onNodeHover={setHoveredNode}
          onNodeClick={(node) => {
            if (graphRef.current) {
              graphRef.current.centerAt(node.x, node.y, 500);
              graphRef.current.zoom(2, 500);
            }
          }}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          cooldownTicks={100}
          d3VelocityDecay={0.3}
        />
      )}

      {/* Hover tooltip */}
      {hoveredNode && hoveredNode.group !== "project" && (
        <div className="absolute bottom-4 left-4 p-3 bg-muted border border-foreground/10 rounded-sm shadow-lg max-w-xs z-10">
          <p className="font-medium text-foreground text-sm">{hoveredNode.name}</p>
          {hoveredNode.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {hoveredNode.description}
            </p>
          )}
          {hoveredNode.business_value && (
            <p className="text-xs text-primary mt-1">
              💡 {hoveredNode.business_value}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: NODE_COLORS[hoveredNode.type || "feature"] + "20",
                color: NODE_COLORS[hoveredNode.type || "feature"],
              }}
            >
              {hoveredNode.type || "feature"}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 p-2 bg-muted/90 border border-foreground/10 rounded-sm text-xs z-10">
        <p className="font-medium text-foreground mb-1">Relationships</p>
        <div className="space-y-1">
          {Object.entries(LINK_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-0.5" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{type.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
