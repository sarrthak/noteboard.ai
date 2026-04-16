"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Node, Edge } from "@xyflow/react";
import { Sparkles, Loader2, AlertCircle, Ticket, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { ArchitectureCanvas } from "@/components/design/architecture-canvas";
import { parseMermaidToReactFlow } from "@/lib/mermaidParser";
import { API_BASE_URL } from "@/lib/api";
import { useModelConfigStore } from "@/store/useModelConfigStore";
import { useActivityStore } from "@/store/useActivityStore";

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
  const { selectedVendor, selectedModel } = useModelConfigStore();
  const runtimeVendor = selectedVendor || "openai";
  const runtimeModel = selectedModel || "gpt-4o";
  const ticketId = params.ticketId;
  const logActivity = useActivityStore((state) => state.logActivity);
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
            vendor: runtimeVendor,
            model: runtimeModel,
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
      console.log("Parsed nodes:", n);
      console.log("Parsed edges:", e);
      setNodes(n);
      setEdges(e);
      logActivity({
        message: `Generated architecture for ${ticketDetails?.title || `ticket ${ticketId}`}`,
        href: `/workspace/design/${ticketId}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }, [session?.accessToken, ticketId, additionalContext, runtimeVendor, runtimeModel, logActivity, ticketDetails?.title]);

  const [ticketExpanded, setTicketExpanded] = useState(false);

  /* ---- Render ---- */
  return (
    <div className="h-[calc(100vh-60px)] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden -m-4 md:-m-6">
      {/* Mobile: Collapsible ticket context header */}
      <div className="lg:hidden border-b border-foreground/10 bg-[#1E1E1D]">
        <button
          onClick={() => setTicketExpanded(!ticketExpanded)}
          className="flex items-center justify-between w-full px-4 py-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {ticketDetails?.title || `Ticket ${ticketId}`}
            </span>
          </div>
          <ChevronDown className={clsx("w-4 h-4 text-foreground/60 transition-transform shrink-0", ticketExpanded && "rotate-180")} />
        </button>
        {ticketExpanded && ticketDetails && (
          <div className="px-4 pb-3 space-y-1">
            {ticketDetails.description && (
              <p className="text-xs text-muted-foreground line-clamp-3">{ticketDetails.description}</p>
            )}
            <div className="flex gap-2">
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{ticketDetails.type}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">{ticketDetails.priority}</span>
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="w-full lg:w-[75%] min-h-[50vh] lg:h-full bg-[#1A1A19] p-2 lg:p-3">
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

      {/* Right Panel — desktop sidebar + mobile sticky button */}
      <div className="hidden lg:flex w-[25%] h-full border-l border-foreground/10 bg-[#1E1E1D] flex-col overflow-y-auto">
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
          <p className="text-[11px] text-muted-foreground">
            Runtime: {runtimeVendor.toUpperCase()} / {runtimeModel}
          </p>
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

      {/* Mobile: Sticky generate button at bottom */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 p-4 bg-[#1A1A19]/90 backdrop-blur-md border-t border-foreground/10">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-background transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
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
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2 mt-2">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
