import type { Node, Edge } from "@xyflow/react";

/**
 * Shape metadata derived from Mermaid node syntax.
 *   [text]      → service
 *   [(text)]    → database  (cylinder)
 *   ((text))    → circle
 *   {text}      → decision  (diamond)
 *   [[text]]    → subroutine
 *   (text)      → rounded
 *   >text]      → asymmetric
 *   default     → service
 */
type NodeShape =
  | "service"
  | "database"
  | "circle"
  | "decision"
  | "subroutine"
  | "rounded"
  | "asymmetric";

interface ParsedLabel {
  label: string;
  shape: NodeShape;
}

/* ---------- helpers ---------- */

function parseLabelAndShape(raw: string): ParsedLabel {
  // [(text)]  — database / cylinder
  let m = raw.match(/^\[\((.+?)\)\]$/);
  if (m) return { label: m[1].trim(), shape: "database" };

  // ((text)) — circle
  m = raw.match(/^\(\((.+?)\)\)$/);
  if (m) return { label: m[1].trim(), shape: "circle" };

  // [[text]] — subroutine
  m = raw.match(/^\[\[(.+?)\]\]$/);
  if (m) return { label: m[1].trim(), shape: "subroutine" };

  // {text} — decision / diamond
  m = raw.match(/^\{(.+?)\}$/);
  if (m) return { label: m[1].trim(), shape: "decision" };

  // [text] — service / process
  m = raw.match(/^\[(.+?)\]$/);
  if (m) return { label: m[1].trim(), shape: "service" };

  // (text) — rounded / stadium
  m = raw.match(/^\((.+?)\)$/);
  if (m) return { label: m[1].trim(), shape: "rounded" };

  // >text] — asymmetric
  m = raw.match(/^>(.+?)\]$/);
  if (m) return { label: m[1].trim(), shape: "asymmetric" };

  return { label: raw.trim(), shape: "service" };
}

/** Strip surrounding double or single quotes from a label. */
function stripQuotes(label: string): string {
  return label.replace(/^["']|["']$/g, "");
}

export function parseMermaidToReactFlow(mermaidCode: string): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodeMap = new Map<string, { label: string; shape: NodeShape }>();
  const edges: Edge[] = [];

  // Normalise: collapse semi-colons into newlines
  const lines = mermaidCode
    .replace(/;/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
    
    console.log("Mermaid lines:", lines);

  // Skip directive lines (graph TD, flowchart LR, %% comments, etc.)
  const contentLines = lines.filter(
    (l) =>
      !/^(graph|flowchart|%%|subgraph|end|classDef|class |style |linkStyle )/i.test(
        l
      )
  );

  console.log("Content lines:", contentLines);
  // Edge patterns — match:
  //   A-->B, A-->|label|B, A -- label --> B, A -.- B, A -.->|label| B
  const SHAPE = String.raw`(?:\[.*?\]|\(\(.*?\)\)|\[\(.*?\)\]|\{.*?\}|\(.*?\)|\[\[.*?\]\]|>.*?\])?`;
  const edgeRegex = new RegExp(
    `^(\\w+)${SHAPE}\\s*` +                       // source + optional shape
    `(?:` +
      `(-+(?:\\.-+)?(?:>|->|-->))\\s*` +           // arrow  (-->, -.->)
      `(?:\\|([^|]*)\\|)?` +                        // optional |label|
    `|` +
      `--\\s+([\\w\\s/]+?)\\s+-->` +               // -- label -->
    `)` +
    `\\s*(\\w+)${SHAPE}`                            // target + optional shape
  );

  // Node definition attached to an edge: e.g. A[API Gateway]
  const nodeDefRegex = /(\w+)(\[.*?\]|\(\(.*?\)\)|\[\(.*?\)\]|\{.*?\}|\(.*?\)|\[\[.*?\]\]|>.*?\])/g;

  for (const line of contentLines) {
    // Extract any inline node definitions first
    let match: RegExpExecArray | null;
    const defRegex = new RegExp(nodeDefRegex.source, "g");
    while ((match = defRegex.exec(line)) !== null) {
      const id = match[1];
      const { label, shape } = parseLabelAndShape(match[2]);
      nodeMap.set(id, { label: stripQuotes(label), shape });
    }

    // Extract edge
    const edgeMatch = line.match(edgeRegex);
    if (edgeMatch) {
      const sourceId = edgeMatch[1];
      const edgeLabel = (edgeMatch[3] || edgeMatch[4] || "").trim() || undefined;
      const targetId = edgeMatch[5];

      // Ensure both nodes exist even if defined without shape
      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, { label: sourceId, shape: "service" });
      }
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, { label: targetId, shape: "service" });
      }

      edges.push({
        id: `e-${sourceId}-${targetId}-${edges.length}`,
        source: sourceId,
        target: targetId,
        label: edgeLabel,
        animated: true,
        style: { stroke: "#EFD30B" },
      });
    }
  }

  // ---------- Layout: simple layered placement ----------
  // Build adjacency for topological ordering
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const id of nodeMap.keys()) {
    incoming.set(id, new Set());
    outgoing.set(id, new Set());
  }
  for (const e of edges) {
    outgoing.get(e.source)?.add(e.target);
    incoming.get(e.target)?.add(e.source);
  }

  // Kahn's algorithm for layers
  const layers: string[][] = [];
  const placed = new Set<string>();
  let frontier = [...nodeMap.keys()].filter(
    (id) => (incoming.get(id)?.size ?? 0) === 0
  );

  while (frontier.length > 0) {
    layers.push(frontier);
    frontier.forEach((id) => placed.add(id));
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of outgoing.get(id) ?? []) {
        const inc = incoming.get(child)!;
        if ([...inc].every((p) => placed.has(p)) && !placed.has(child)) {
          next.push(child);
        }
      }
    }
    frontier = [...new Set(next)];
    // Safety: if nothing new but some nodes remain, dump them
    if (frontier.length === 0 && placed.size < nodeMap.size) {
      const remaining = [...nodeMap.keys()].filter((id) => !placed.has(id));
      frontier = remaining;
    }
  }

  const COL_GAP = 280;
  const ROW_GAP = 120;

  const nodes: Node[] = [];
  for (let row = 0; row < layers.length; row++) {
    const layer = layers[row];
    const layerWidth = (layer.length - 1) * COL_GAP;
    const startX = -layerWidth / 2;
    for (let col = 0; col < layer.length; col++) {
      const id = layer[col];
      const meta = nodeMap.get(id)!;
      nodes.push({
        id,
        type: "techNode",
        position: { x: startX + col * COL_GAP, y: row * ROW_GAP },
        data: { label: meta.label, shape: meta.shape },
      });
    }
  }

  console.log("Parsed nodes:", nodes);
  console.log("Parsed edges:", edges);

  return { nodes, edges };
}
