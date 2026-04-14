"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { API_BASE_URL } from "@/lib/api";

/* ── Types ────────────────────────────────────────────────── */

interface LogEntry {
  log: string;
  step: string;
  status: string;
}

type Step = "idle" | "plan" | "draft" | "verify" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "draft", label: "Draft" },
  { key: "verify", label: "Verify" },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4.1-mini", "gpt-4o-mini"],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "deepseek/deepseek-chat",
    "x-ai/grok-2-1212",
  ],
};

function wsUrl(ticketId: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base.replace(/\/$/, "")}/dev/ws/${ticketId}`;
}

function stepIndex(s: Step): number {
  return STEPS.findIndex((x) => x.key === s);
}

export default function DevMissionControlPage() {
  const params = useParams<{ ticketId: string }>();
  const { data: session } = useSession();
  const ticketId = params.ticketId;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeStep, setActiveStep] = useState<Step>("idle");
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [buildStarted, setBuildStarted] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("openai");
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS.openai[0]);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticketId) return;

    const ws = new WebSocket(wsUrl(ticketId));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data: LogEntry = JSON.parse(event.data);
        setLogs((prev) => [...prev, data]);
        setActiveStep(data.step as Step);
        setIsWaitingForApproval(data.status === "awaiting_approval");

        if (data.step === "verify" && data.status === "running") {
          // Final step complete
          setTimeout(() => setActiveStep("done"), 800);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [ticketId]);

  /* ── Auto-scroll terminal ───────────────────────────── */
  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

  useEffect(() => {
    const vendorModels = MODEL_OPTIONS[selectedVendor] ?? [];
    if (vendorModels.length > 0 && !vendorModels.includes(selectedModel)) {
      setSelectedModel(vendorModels[0]);
    }
  }, [selectedVendor, selectedModel]);

  /* ── Actions ────────────────────────────────────────── */
  const startBuild = useCallback(async () => {
    if (!session?.accessToken || !ticketId) return;
    await fetch(`${API_BASE_URL}/dev/start_build/${ticketId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vendor: selectedVendor,
        model: selectedModel,
      }),
    });
    setBuildStarted(true);
    setLogs([]);
    setActiveStep("idle");
    setIsWaitingForApproval(false);
  }, [session?.accessToken, ticketId, selectedVendor, selectedModel]);

  const approveCheckpoint = useCallback(async () => {
    if (!session?.accessToken || !ticketId || activeStep === "idle" || activeStep === "done") return;
    await fetch(`${API_BASE_URL}/dev/approve_checkpoint/${ticketId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ step: activeStep }),
    });
    setIsWaitingForApproval(false);
  }, [session?.accessToken, ticketId, activeStep]);

  /* ── Render ─────────────────────────────────────────── */
  const currentIdx = stepIndex(activeStep);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3 max-w-[1400px] mx-auto">
      {/* ─── Header chrome ───────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-px w-6 bg-primary/40" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-primary/50 uppercase">
            mission&nbsp;control
          </span>
          <div className="h-px w-6 bg-primary/40" />
        </div>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground/40">
          tkt:{ticketId?.slice(0, 8)}
        </span>
      </div>

      {/* ─── Checkpoint Stepper (top, full width) ───── */}
      <div
        className="rounded-sm px-6 py-4 flex items-center justify-center gap-0"
        style={{ background: "#1A1A19", border: "1px solid #333" }}
      >
        {STEPS.map((step, i) => {
          const isCurrent = step.key === activeStep;
          const isComplete =
            activeStep === "done" || (currentIdx > i && currentIdx !== -1);
          const isPulsing = isCurrent && isWaitingForApproval;

          return (
            <div key={step.key} className="flex items-center">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                <div
                  className={`
                    relative w-8 h-8 rounded-full flex items-center justify-center
                    font-mono text-xs font-bold transition-all duration-300
                    ${isPulsing ? "animate-pulse" : ""}
                  `}
                  style={{
                    background: isCurrent
                      ? "rgba(239,211,11,0.15)"
                      : isComplete
                        ? "rgba(239,211,11,0.08)"
                        : "rgba(255,255,255,0.03)",
                    border: `2px solid ${
                      isCurrent
                        ? "#EFD30B"
                        : isComplete
                          ? "rgba(239,211,11,0.4)"
                          : "#333"
                    }`,
                    color: isCurrent || isComplete ? "#EFD30B" : "#555",
                    boxShadow: isCurrent
                      ? "0 0 14px rgba(239,211,11,0.25)"
                      : "none",
                  }}
                >
                  {isComplete && !isCurrent ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className="font-mono text-[10px] tracking-widest uppercase"
                  style={{
                    color: isCurrent ? "#EFD30B" : isComplete ? "rgba(239,211,11,0.5)" : "#555",
                  }}
                >
                  {step.label}
                </span>
                {isCurrent && isWaitingForApproval && (
                  <span className="font-mono text-[9px] tracking-wider text-primary/70 animate-pulse">
                    AWAITING APPROVAL
                  </span>
                )}
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className="h-[2px] w-16 mx-2 rounded-full transition-all duration-500"
                  style={{
                    background:
                      currentIdx > i || activeStep === "done"
                        ? "rgba(239,211,11,0.4)"
                        : "#333",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Bottom panes ────────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* ── Live Terminal (70%) ───────────────────── */}
        <div className="flex flex-col w-[70%] min-h-0">
          {/* Terminal chrome */}
          <div
            className="flex items-center justify-between px-4 py-2 rounded-t-sm"
            style={{ background: "#111", borderTop: "1px solid #333", borderLeft: "1px solid #333", borderRight: "1px solid #333" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50 ml-2">
                live_terminal — agent_output
              </span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground/30">
              {logs.length} entries
            </span>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto px-4 py-3 rounded-b-sm"
            style={{
              background: "#000",
              borderBottom: "1px solid #333",
              borderLeft: "1px solid #333",
              borderRight: "1px solid #333",
            }}
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="font-mono text-xs text-muted-foreground/30">
                  {buildStarted ? "Waiting for agent output..." : "Start a build to see output here."}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/15">▌</span>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((entry, i) => (
                  <div key={i} className="flex gap-2 font-mono text-xs leading-relaxed">
                    {/* Timestamp-like prefix */}
                    <span className="text-muted-foreground/25 shrink-0 select-none tabular-nums w-7 text-right">
                      {String(i + 1).padStart(3, "0")}
                    </span>

                    {/* Step badge */}
                    <span
                      className="shrink-0 uppercase tracking-wider text-[10px] w-14 text-right"
                      style={{
                        color:
                          entry.step === "plan"
                            ? "#60A5FA"
                            : entry.step === "draft"
                              ? "#C084FC"
                              : "#34D399",
                      }}
                    >
                      [{entry.step}]
                    </span>

                    {/* Log message */}
                    <span
                      style={{
                        color:
                          entry.status === "awaiting_approval"
                            ? "#EFD30B"
                            : "#00FF00",
                      }}
                    >
                      {entry.log}
                    </span>
                  </div>
                ))}

                {/* Blinking cursor */}
                <div className="flex gap-2 font-mono text-xs">
                  <span className="text-muted-foreground/25 w-7" />
                  <span className="w-14" />
                  <span className="text-[#00FF00] animate-pulse">▌</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Agent Controls (30%) ─────────────────── */}
        <div
          className="w-[30%] rounded-sm flex flex-col"
          style={{ background: "#1A1A19", border: "1px solid #333" }}
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "#333" }}>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50 uppercase">
              Agent Controls
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-between p-4">
            {/* Status readout */}
            <div className="space-y-3">
              <StatusRow label="Phase" value={activeStep.toUpperCase()} />
              <StatusRow
                label="State"
                value={
                  activeStep === "idle"
                    ? "STANDBY"
                    : activeStep === "done"
                      ? "COMPLETE"
                      : isWaitingForApproval
                        ? "BLOCKED"
                        : "RUNNING"
                }
                color={
                  activeStep === "done"
                    ? "#28C840"
                    : isWaitingForApproval
                      ? "#EFD30B"
                      : "#00FF00"
                }
              />
              <StatusRow label="Ticket" value={ticketId?.slice(0, 12) ?? "—"} />
              <StatusRow label="Vendor" value={selectedVendor.toUpperCase()} />
            </div>

            <div className="space-y-3 mt-5">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] tracking-wider text-muted-foreground/40 uppercase block">
                  Vendor
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  disabled={buildStarted && activeStep !== "done"}
                  className="w-full rounded-sm py-2 px-3 font-mono text-[11px]"
                  style={{
                    background: "rgba(249,248,244,0.05)",
                    border: "1px solid #444",
                    color: "#F9F8F4",
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] tracking-wider text-muted-foreground/40 uppercase block">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={buildStarted && activeStep !== "done"}
                  className="w-full rounded-sm py-2 px-3 font-mono text-[11px]"
                  style={{
                    background: "rgba(249,248,244,0.05)",
                    border: "1px solid #444",
                    color: "#F9F8F4",
                  }}
                >
                  {(MODEL_OPTIONS[selectedVendor] ?? []).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 mt-6">
              {/* Start Build */}
              <button
                onClick={startBuild}
                disabled={buildStarted && activeStep !== "done"}
                className="w-full font-mono text-xs tracking-wider uppercase rounded-sm py-3 px-4 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(249,248,244,0.05)",
                  border: "1px solid #444",
                  color: "#F9F8F4",
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.borderColor = "#F9F8F4";
                    e.currentTarget.style.background = "rgba(249,248,244,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#444";
                  e.currentTarget.style.background = "rgba(249,248,244,0.05)";
                }}
              >
                {buildStarted && activeStep !== "done"
                  ? "Build in progress…"
                  : activeStep === "done"
                    ? "Restart Build"
                    : "Start Build"}
              </button>

              {/* Approve Checkpoint */}
              {isWaitingForApproval && (
                <button
                  onClick={approveCheckpoint}
                  className="w-full font-mono text-xs tracking-wider uppercase rounded-sm py-3 px-4 transition-all duration-200 animate-pulse"
                  style={{
                    background: "rgba(239,211,11,0.12)",
                    border: "2px solid #EFD30B",
                    color: "#EFD30B",
                    boxShadow: "0 0 20px rgba(239,211,11,0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,211,11,0.22)";
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(239,211,11,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239,211,11,0.12)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(239,211,11,0.15)";
                  }}
                >
                  Approve {activeStep}
                </button>
              )}

              {/* Done indicator */}
              {activeStep === "done" && (
                <div
                  className="w-full font-mono text-xs tracking-wider uppercase text-center rounded-sm py-3 px-4"
                  style={{
                    background: "rgba(40,200,64,0.08)",
                    border: "1px solid rgba(40,200,64,0.3)",
                    color: "#28C840",
                  }}
                >
                  ✓ Build Complete
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer rule ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
        <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/20 uppercase">
          mission control v1
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function StatusRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/40 uppercase">
        {label}
      </span>
      <span
        className="font-mono text-[11px] tracking-wider font-medium"
        style={{ color: color ?? "#F9F8F4" }}
      >
        {value}
      </span>
    </div>
  );
}
