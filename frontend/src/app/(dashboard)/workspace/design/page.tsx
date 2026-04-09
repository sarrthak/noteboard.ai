"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProjectStore } from "@/store/useProjectStore";
import { API_BASE_URL } from "@/lib/api";
import { Sparkles, Loader2, Ticket, ChevronRight } from "lucide-react";

interface TicketItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
}

const priorityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10",
  high: "text-orange-400 bg-orange-400/10",
  medium: "text-primary bg-primary/10",
  low: "text-muted-foreground bg-foreground/5",
};

export default function DesignIndexPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { selectedProjectId } = useProjectStore();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        setTickets(data);
      } catch {
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [selectedProjectId, session?.accessToken]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Design Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select a ticket to generate its architecture diagram.
        </p>
      </div>

      {/* Content */}
      {!selectedProjectId ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Sparkles className="w-10 h-10 text-primary/30" />
          <p className="text-sm">Select a project from the sidebar to get started.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Ticket className="w-10 h-10 text-primary/30" />
          <p className="text-sm">No tickets found. Create tickets in the Huddle first.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => router.push(`/workspace/design/${ticket.id}`)}
              className="flex items-center gap-4 w-full text-left rounded-lg border border-foreground/10 bg-muted/30 px-5 py-4 transition-colors hover:bg-muted/60 hover:border-primary/20 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {ticket.title}
                </p>
                {ticket.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ticket.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {ticket.type}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                    priorityColor[ticket.priority] ?? priorityColor.medium
                  }`}
                >
                  {ticket.priority}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
