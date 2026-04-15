"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Check, Trash2, Loader2, Sparkles, CheckCheck, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { useHuddleStore } from "@/store/useHuddleStore";
import { useSession } from "next-auth/react";
import { createAudioFormData } from "@/lib/audio-utils";
import { API_BASE_URL } from "@/lib/api";
import { useModelConfigStore } from "@/store/useModelConfigStore";

interface PrepStationProps {
  projectId?: string;
}

interface ConfirmedTicketResponse {
  id: string;
  title: string;
  description: string;
  business_value: string;
  type: string;
}

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function getSupportedRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return RECORDER_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function PrepStation({ projectId }: PrepStationProps) {
  const { data: session } = useSession();
  const { selectedVendor, selectedModel } = useModelConfigStore();
  const runtimeVendor = selectedVendor || "openai";
  const runtimeModel = selectedModel || "gpt-4o";
  const {
    isRecording,
    transcript,
    draftTickets,
    startRecording,
    stopRecording,
    setTranscript,
    setDraftTickets,
    approveTicket,
    removeDraftTicket,
    addCapabilities,
  } = useHuddleStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef<string>("audio/webm");

  // Cleanup on unmount: stop mic stream and recorder to prevent leaked tracks
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (!session?.accessToken) {
      alert("You must be logged in to transcribe audio.");
      return;
    }

    setIsProcessing(true);

    try {
      // Convert to WAV when possible; utility falls back to original audio blob if needed.
      const formData = await createAudioFormData(audioBlob, "file");

      const response = await fetch(
        `${API_BASE_URL}/huddle/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        let detail = "Failed to transcribe audio";
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.detail === "string" && errorPayload.detail.trim()) {
            detail = errorPayload.detail;
          }
        } catch {
          // Keep generic detail when response body is not JSON.
        }
        throw new Error(detail);
      }

      const data = await response.json();
      setTranscript(data.text);
    } catch (error) {
      console.error("Failed to transcribe audio:", error);
      const message = error instanceof Error ? error.message : "Failed to process audio. Please try again.";
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  }, [session?.accessToken, setTranscript]);

  const handleStartRecording = useCallback(async () => {
    if (!window.isSecureContext) {
      alert("Microphone recording requires HTTPS (or localhost). Please open the app over a secure origin.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("This browser does not support microphone capture.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const supportedMimeType = getSupportedRecorderMimeType();
      const mediaRecorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      recorderMimeTypeRef.current = mediaRecorder.mimeType || supportedMimeType || "audio/webm";

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks via the ref
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, {
          type: recorderMimeTypeRef.current,
        });

        // Transcribe audio
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start(1000); // Collect data every second
      startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not start microphone recording. Check browser microphone permissions and try again.");
    }
  }, [startRecording, transcribeAudio]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      stopRecording();
    }
  }, [stopRecording]);

  const handleGenerateTickets = async () => {
    if (!transcript.trim() || !projectId) {
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/huddle/synthesize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ 
            transcript,
            project_id: projectId,
            vendor: runtimeVendor,
            model: runtimeModel,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate tickets");
      }

      const data = await response.json();
      setDraftTickets(data.tickets);
    } catch (error) {
      console.error("Failed to generate tickets:", error);
      alert("Failed to generate tickets. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Confirm all draft tickets and add to knowledge graph
  const handleConfirmAll = async () => {
    if (!projectId || draftTickets.length === 0) return;

    setIsConfirming(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/huddle/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            vendor: runtimeVendor,
            model: runtimeModel,
            tickets: draftTickets.map((t) => ({
              title: t.title,
              description: t.description,
              business_value: t.business_value,
              type: t.type || "feature",
              priority: t.priority || "medium",
              dependencies: t.dependencies || [],
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to confirm tickets");
      }

      const data = await response.json() as { tickets: ConfirmedTicketResponse[] };

      // Add capabilities to the local graph store for immediate visualization
      addCapabilities(
        data.tickets.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          business_value: t.business_value,
          type: t.type,
          dependencies: draftTickets.find((d) => d.title === t.title)?.dependencies || [],
        }))
      );

      // Clear draft tickets
      setDraftTickets([]);
    } catch (error) {
      console.error("Failed to confirm tickets:", error);
      alert("Failed to confirm tickets. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const [mobileExpanded, setMobileExpanded] = useState(true);

  return (
    <div className="w-full lg:w-[35%] lg:h-full flex flex-col bg-[#1A1A19] border-r border-[#F9F8F4]/10 p-4 lg:p-6">
      {/* Header */}
      <button
        onClick={() => setMobileExpanded(!mobileExpanded)}
        className="flex items-center justify-between w-full lg:pointer-events-none"
      >
        <h2 className="text-xl font-semibold text-foreground">Prep Station</h2>
        <ChevronDown
          className={clsx(
            "w-5 h-5 text-foreground/60 transition-transform lg:hidden",
            mobileExpanded && "rotate-180"
          )}
        />
      </button>
      <div className="mb-4 lg:mb-6" />

      {/* Collapsible content on mobile */}
      <div className={clsx("flex flex-col", !mobileExpanded && "hidden lg:flex")}>

      {/* Microphone Trigger */}
      <div className="flex flex-col items-center mb-6">
        <button
          onClick={toggleRecording}
          disabled={isProcessing}
          className={`
            relative w-24 h-24 rounded-full transition-all duration-300
            flex items-center justify-center
            ${
              isRecording
                ? "bg-[#EFD30B] text-[#1A1A19]"
                : "bg-transparent border-2 border-[#EFD30B] text-[#EFD30B] hover:bg-[#EFD30B]/10"
            }
            ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {/* Pulse animation when recording */}
          {isRecording && (
            <>
              <span className="absolute inset-0 rounded-full bg-[#EFD30B] animate-ping opacity-30" />
              <span className="absolute inset-0 rounded-full bg-[#EFD30B] animate-pulse opacity-20" />
            </>
          )}

          {isProcessing ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-10 h-10 relative z-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>

        <p className="mt-3 text-sm text-foreground/60">
          {isProcessing
            ? "Transcribing..."
            : isRecording
            ? "Click to stop recording"
            : "Click to start recording"}
        </p>
      </div>

      {/* Transcript Area */}
      <div className="flex flex-col mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground/80">Transcript</h3>
          {transcript && (
            <button
              onClick={handleGenerateTickets}
              disabled={isGenerating || !projectId}
              className="flex items-center gap-1.5 text-xs text-[#EFD30B] hover:text-[#D4BC0A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!projectId ? "Select a project first" : "Generate Capabilities"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? "Generating..." : "Generate Capabilities"}
            </button>
          )}
        </div>
        {!projectId && (
          <div className="mb-2 px-3 py-2 bg-[#EFD30B]/10 border border-[#EFD30B]/20 rounded-lg">
            <p className="text-xs text-[#EFD30B]">
              ⚠️ Select a project from the dropdown above to generate capabilities
            </p>
          </div>
        )}
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Start recording to see your transcript here, or type/paste text directly..."
          className="h-40 bg-foreground/5 rounded-lg p-4 text-sm text-foreground/80 
                     border border-foreground/10 resize-none focus:outline-none 
                     focus:border-[#EFD30B]/50 focus:ring-1 focus:ring-[#EFD30B]/20
                     placeholder:text-foreground/40 placeholder:italic"
        />
      </div>

      {/* Draft Zone */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground/80">
            Proposed Capabilities{" "}
            {draftTickets.length > 0 && (
              <span className="text-foreground/50">({draftTickets.length})</span>
            )}
          </h3>
          {draftTickets.length > 0 && (
            <button
              onClick={handleConfirmAll}
              disabled={isConfirming || !projectId}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-[#EFD30B] text-[#1A1A19] rounded-md
                         hover:bg-[#D4BC0A] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              {isConfirming ? "Confirming..." : "Confirm All"}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence mode="popLayout">
            {draftTickets.map((ticket, index) => (
              <motion.div
                key={`${ticket.title}-${index}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-foreground/5 border border-foreground/10 rounded-lg p-4 
                           hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm">
                      {ticket.title}
                    </h4>
                    <p className="text-xs text-foreground/60 mt-1 line-clamp-2">
                      {ticket.description}
                    </p>
                    {ticket.business_value && (
                      <p className="text-xs text-[#EFD30B]/80 mt-2 line-clamp-1">
                        💡 {ticket.business_value}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => approveTicket(index)}
                      className="p-2 rounded-md bg-green-500/10 text-green-500 
                                 hover:bg-green-500/20 transition-colors"
                      title="Approve capability"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeDraftTicket(index)}
                      className="p-2 rounded-md bg-red-500/10 text-red-500 
                                 hover:bg-red-500/20 transition-colors"
                      title="Discard capability"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {draftTickets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="w-8 h-8 text-foreground/20 mb-2" />
              <p className="text-sm text-foreground/40">
                Capabilities will appear here after generation
              </p>
            </div>
          )}
        </div>
      </div>

      {/* end collapsible wrapper */}
      </div>
    </div>
  );
}
