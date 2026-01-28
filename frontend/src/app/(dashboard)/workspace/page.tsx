export default function WorkspacePage() {
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

      {/* Recent Activity Placeholder */}
      <div className="border border-foreground/10 bg-muted/30 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-background/50 border border-foreground/5"
            >
              <div className="w-2 h-2 bg-primary rounded-full" />
              <p className="text-sm text-muted-foreground">
                Activity item placeholder {i}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
