"use client";

import { useRouter } from "next/navigation";
import { useActivityStore } from "@/store/useActivityStore";

function formatRelativeTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  const now = Date.now();
  const diffInMinutes = Math.max(1, Math.floor((now - timestamp) / (1000 * 60)));

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function WorkspacePage() {
  const router = useRouter();
  const activityItems = useActivityStore((state) => state.items);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome to your workspace
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Active Projects", value: "3" },
          { label: "Tasks Completed", value: "12" },
          { label: "Team Members", value: "5" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-6 border border-foreground/10 bg-muted/30"
          >
            <p className="text-3xl font-bold text-primary">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="border border-foreground/10 bg-muted/30 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Recent Activity
        </h2>
        {activityItems.length === 0 ? (
          <div className="p-4 bg-background/40 border border-foreground/5">
            <p className="text-sm text-muted-foreground">
              No activity yet. Create a project or update tickets in Huddle to populate this feed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activityItems.slice(0, 8).map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="w-full text-left flex items-center justify-between gap-3 p-3 bg-background/50 border border-foreground/5 hover:border-primary/20 hover:bg-background/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  <p className="text-sm text-foreground/90 truncate">{item.message}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
