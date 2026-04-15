"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Network } from "lucide-react";
import { PrepStation } from "@/components/huddle/prep-station";
import { Stove } from "@/components/huddle/stove";
import { KnowledgeGraph } from "@/components/huddle/knowledge-graph";
import { useProjectStore } from "@/store/useProjectStore";
import { clsx } from "clsx";

export default function HuddlePage() {
  const searchParams = useSearchParams();
  const { selectedProjectId, selectProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<"stove" | "pantry">("stove");

  // Sync URL project param with store
  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (urlProjectId && urlProjectId !== selectedProjectId) {
      selectProject(urlProjectId);
    }
  }, [searchParams, selectedProjectId, selectProject]);

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      {/* Left Panel - Prep Station */}
      <PrepStation projectId={selectedProjectId || undefined} />

      {/* Right Panel - Stove/Pantry */}
      <div className="w-full lg:w-[65%] flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-foreground/10">
        {/* Header with Toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
          <h2 className="text-sm font-semibold text-foreground">
            Project Capability Board
          </h2>
          
          {/* Segmented Control */}
          <div className="flex items-center bg-muted rounded-sm p-0.5">
            <button
              onClick={() => setViewMode("stove")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sm transition-all",
                viewMode === "stove"
                  ? "bg-primary text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Stove
            </button>
            <button
              onClick={() => setViewMode("pantry")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sm transition-all",
                viewMode === "pantry"
                  ? "bg-primary text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Network className="w-4 h-4" />
              Pantry
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "stove" ? (
            <Stove projectId={selectedProjectId || undefined} />
          ) : (
            <KnowledgeGraph projectId={selectedProjectId || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
