"use client";

import { useSearchParams } from "next/navigation";
import { PrepStation } from "@/components/huddle/prep-station";
import { Stove } from "@/components/huddle/stove";

export default function HuddlePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || undefined;

  return (
    <div className="h-full flex">
      {/* Left Panel - Prep Station (40%) */}
      <PrepStation />

      {/* Right Panel - The Stove (60%) */}
      <Stove projectId={projectId} />
    </div>
  );
}
