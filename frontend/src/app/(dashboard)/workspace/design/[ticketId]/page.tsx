"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Node, Edge } from "@xyflow/react";
import { Sparkles, Loader2, AlertCircle, Ticket } from "lucide-react";
import { ArchitectureCanvas } from "@/components/design/architecture-canvas";
import { parseMermaidToReactFlow } from "@/lib/mermaidParser";
import { API_BASE_URL } from "@/lib/api";

interface TicketDetails {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  business_value: string | null;
}

export default function DesignPage() {
  const params = useParams<{ ticketId: string }>();
  const { data: session } = useSession();
  const ticketId = params.ticketId;
  const canGenerate = Boolean(session?.accessToken && ticketId);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rawMermaid, setRawMermaid] = useState<string | null>(null);

  /* ---- Fetch ticket details on mount ---- */
  useEffect(() => {
    if (!ticketId || !session?.accessToken) return;

    (async () => {
      try {
        // We don't have a single-ticket GET, so we search via project tickets.
        // For now, fetch from the tickets endpoint directly.
        const res = await fetch(
          `${API_BASE_URL}/tickets/${ticketId}`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (!res.ok) throw new Error("Could not load ticket");
        const data: TicketDetails = await res.json();
        setTicketDetails(data);
      } catch {
        // Fallback — ticket details remain null, user can still generate
        setTicketDetails(null);
      }
    })();
  }, [ticketId, session?.accessToken]);

  /* ---- Generate HLD ---- */
  const handleGenerate = useCallback(async () => {
    if (!session?.accessToken || !ticketId) {
      setError("Unable to generate design: missing session or ticket context.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setRawMermaid(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/design/generate_hld`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            ticket_id: ticketId,
            additional_context: additionalContext || null,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Generation failed");
      }

      const { mermaid_code } = await res.json();
      setRawMermaid(mermaid_code);

      const { nodes: n, edges: e } = parseMermaidToReactFlow(mermaid_code);
      setNodes(n);
      setEdges(e);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }, [session?.accessToken, ticketId, additionalContext]);

  /* ---- Render ---- */
  return (
    <div className="h-[calc(100vh-60px)] flex overflow-hidden -m-6">
      {/* Canvas — 75 % */}
      <div className="w-[75%] h-full bg-[#1A1A19] p-3">
        {nodes.length > 0 ? (
          <ArchitectureCanvas initialNodes={nodes} initialEdges={edges} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Sparkles className="w-12 h-12 text-primary/30" />
            <p className="text-sm">
              Click <span className="text-primary font-medium">Auto-Architect</span> to generate an architecture diagram.
            </p>
          </div>
        )}
      </div>

      {/* Right Panel — 25 % */}
      <div className="w-[25%] h-full border-l border-foreground/10 bg-[#1E1E1D] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-foreground/10">
          <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
            Architect Controls
          </h2>
        </div>

        {/* Ticket summary */}
        <div className="px-5 py-4 border-b border-foreground/10 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <Ticket className="w-3.5 h-3.5" />
            Ticket
          </div>
          {ticketDetails ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground leading-snug">
                {ticketDetails.title}
              </p>
              {ticketDetails.description && (
                <p className="text-xs text-muted-foreground line-clamp-4">
                  {ticketDetails.description}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {ticketDetails.type}
                </span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                  {ticketDetails.priority}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ticket ID: {ticketId}
            </p>
          )}
        </div>

        {/* Additional context */}
        <div className="px-5 py-4 border-b border-foreground/10 space-y-2">
          <label
            htmlFor="ctx"
            className="text-xs text-muted-foreground uppercase tracking-wider"
          >
            Additional Context
          </label>
          <textarea
            id="ctx"
            rows={4}
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="E.g. 'Use a microservices pattern with Kafka for messaging…'"
            className="w-full rounded-md border border-foreground/10 bg-[#2A2A29] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* Generate button */}
        <div className="px-5 py-4 space-y-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Auto-Architect
              </>
            )}
          </button>

          {!canGenerate && !isGenerating && (
            <p className="text-xs text-muted-foreground">
              Sign in again and open this page from a ticket to enable Auto-Architect.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Raw mermaid preview */}
        {rawMermaid && (
          <div className="px-5 pb-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Mermaid Source
            </p>
            <pre className="rounded-md bg-[#2A2A29] border border-foreground/10 p-3 text-xs text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
              {rawMermaid}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
