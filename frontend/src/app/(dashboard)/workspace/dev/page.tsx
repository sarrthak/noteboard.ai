"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProjectStore } from "@/store/useProjectStore";
import { API_BASE_URL } from "@/lib/api";

interface TicketItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
}

const priorityTag: Record<string, { label: string; color: string }> = {
  critical: { label: "CRIT", color: "#EF4444" },
  high: { label: "HIGH", color: "#F97316" },
  medium: { label: "MED", color: "#EFD30B" },
  low: { label: "LOW", color: "#6B7280" },
};

const statusTag: Record<string, string> = {
  todo: "QUEUED",
  "in-progress": "IN-PROG",
};

export default function DevIndexPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { selectedProjectId } = useProjectStore();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProjectId || !session?.accessToken) return;

    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/projects/${selectedProjectId}/tickets`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (!res.ok) throw new Error("Failed to fetch tickets");
        const data: TicketItem[] = await res.json();
        setTickets(
          data.filter((t) => t.status === "todo" || t.status === "in-progress")
        );
      } catch {
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [selectedProjectId, session?.accessToken]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="relative">
        {/* Decorative top rule */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-primary/50 uppercase">
            sys://forge
          </span>
          <div className="h-px w-12 bg-primary/20" />
        </div>

        <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">
          The Forge
        </h1>
        <p className="font-mono text-xs tracking-wide text-muted-foreground mt-2 max-w-md">
          Select an approved capability to initiate Agentic Build.
        </p>

        {/* Status bar */}
        <div className="flex items-center gap-4 mt-4 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            Agent Online
          </span>
          <span className="text-foreground/10">│</span>
          <span>{tickets.length} target{tickets.length !== 1 ? "s" : ""} ready</span>
          <span className="text-foreground/10">│</span>
          <span>
            project:{" "}
            <span className="text-primary/60">
              {selectedProjectId ? selectedProjectId.slice(0, 8) : "none"}
            </span>
          </span>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      {!selectedProjectId ? (
        <EmptyState message="Link a project from the sidebar to load targets." />
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
            <div className="absolute inset-1 rounded-full border border-primary/50 animate-spin" />
            <div className="absolute inset-2.5 rounded-full bg-primary/20" />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
            SCANNING TARGETS...
          </span>
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState message="No eligible tickets found. Create tickets in the Huddle, then return." />
      ) : (
        <div className="grid gap-3">
          {/* Column labels */}
          <div className="grid grid-cols-[1fr_72px_60px_28px] gap-4 px-5 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/40 uppercase">
            <span>Capability</span>
            <span className="text-center">Status</span>
            <span className="text-center">Pri</span>
            <span />
          </div>

          {tickets.map((ticket, i) => {
            const isHovered = hoveredId === ticket.id;
            const pri = priorityTag[ticket.priority] ?? priorityTag.medium;
            const statusLabel = statusTag[ticket.status] ?? ticket.status.toUpperCase();

            return (
              <button
                key={ticket.id}
                onClick={() => router.push(`/workspace/dev/${ticket.id}`)}
                onMouseEnter={() => setHoveredId(ticket.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative grid grid-cols-[1fr_72px_60px_28px] items-center gap-4 w-full text-left rounded-sm px-5 py-4 transition-all duration-200"
                style={{
                  background: "#1A1A19",
                  border: `1px solid ${isHovered ? "#EFD30B" : "#333"}`,
                  boxShadow: isHovered
                    ? "0 0 20px rgba(239,211,11,0.08), inset 0 0 20px rgba(239,211,11,0.03)"
                    : "none",
                }}
              >
                {/* Row index + Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[10px] text-muted-foreground/30 w-4 shrink-0 text-right tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors duration-200">
                      {ticket.title}
                    </p>
                    {ticket.description && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate font-mono">
                        {ticket.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span className="font-mono text-[10px] tracking-wider text-center px-2 py-0.5 rounded-sm bg-foreground/5 text-muted-foreground">
                  {statusLabel}
                </span>

                {/* Priority */}
                <span
                  className="font-mono text-[10px] tracking-wider text-center px-2 py-0.5 rounded-sm"
                  style={{
                    color: pri.color,
                    background: `${pri.color}12`,
                  }}
                >
                  {pri.label}
                </span>

                {/* Arrow */}
                <svg
                  className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary transition-all duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Left accent bar on hover */}
                <div
                  className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-all duration-200"
                  style={{
                    background: isHovered ? "#EFD30B" : "transparent",
                    boxShadow: isHovered ? "0 0 6px rgba(239,211,11,0.4)" : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Footer rule ────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
        <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/20 uppercase">
          end of manifest
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Crosshair */}
        <div className="absolute inset-0 border border-dashed border-muted-foreground/15 rounded-full" />
        <div className="absolute w-full h-px bg-muted-foreground/10" />
        <div className="absolute h-full w-px bg-muted-foreground/10" />
        <div className="w-2 h-2 rounded-full bg-muted-foreground/15" />
      </div>
      <p className="font-mono text-xs text-muted-foreground/50 text-center max-w-xs">
        {message}
      </p>
    </div>
  );
}
