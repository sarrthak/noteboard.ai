"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Check, X, Loader2 } from "lucide-react";
import { useHuddleStore } from "@/store/useHuddleStore";
import { useSession } from "next-auth/react";
import { createAudioFormData } from "@/lib/audio-utils";

export function PrepStation() {
  const { data: session } = useSession();
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
  } = useHuddleStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Upload to backend
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start(1000); // Collect data every second
      startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      stopRecording();
    }
  }, [stopRecording]);

  const uploadAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // Convert to WAV format for better compatibility with Whisper API
      const formData = await createAudioFormData(audioBlob, "audio");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/huddle/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to upload audio");
      }

      const data = await response.json();
      setTranscript(data.transcript);
    } catch (error) {
      console.error("Failed to upload audio:", error);
      alert("Failed to process audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSynthesize = async () => {
    if (!transcript.trim()) return;

    setIsSynthesizing(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/huddle/synthesize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ transcript }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to synthesize tickets");
      }

      const data = await response.json();
      setDraftTickets(data.tickets);
    } catch (error) {
      console.error("Failed to synthesize tickets:", error);
      alert("Failed to generate tickets. Please try again.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <div className="w-[40%] h-full flex flex-col bg-background border-r border-foreground/10 p-6">
      {/* Header */}
      <h2 className="text-xl font-semibold text-foreground mb-6">Prep Station</h2>

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
                ? "bg-primary text-background"
                : "bg-transparent border-2 border-primary text-primary hover:bg-primary/10"
            }
            ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {/* Pulse animation when recording */}
          {isRecording && (
            <>
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
              <span className="absolute inset-0 rounded-full bg-primary animate-pulse opacity-20" />
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
            ? "Processing audio..."
            : isRecording
            ? "Click to stop recording"
            : "Click to start recording"}
        </p>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 flex flex-col min-h-0 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground/80">Transcript</h3>
          {transcript && (
            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="text-xs text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
            >
              {isSynthesizing ? "Synthesizing..." : "Generate Tickets →"}
            </button>
          )}
        </div>
        <div className="flex-1 bg-foreground/5 rounded-lg p-4 overflow-y-auto border border-foreground/10">
          {transcript ? (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">
              {transcript}
            </p>
          ) : (
            <p className="text-sm text-foreground/40 italic">
              Start recording to see your transcript here...
            </p>
          )}
        </div>
      </div>

      {/* Draft Zone */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-medium text-foreground/80 mb-2">
          Proposed Tickets ({draftTickets.length})
        </h3>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence mode="popLayout">
            {draftTickets.map((ticket, index) => (
              <motion.div
                key={`${ticket.title}-${index}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-foreground/5 border border-foreground/10 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm truncate">
                      {ticket.title}
                    </h4>
                    <p className="text-xs text-foreground/60 mt-1 line-clamp-2">
                      {ticket.description}
                    </p>
                    {ticket.business_value && (
                      <p className="text-xs text-primary/80 mt-2 line-clamp-1">
                        💡 {ticket.business_value}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => approveTicket(index)}
                      className="p-2 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                      title="Approve ticket"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeDraftTicket(index)}
                      className="p-2 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                      title="Discard ticket"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {draftTickets.length === 0 && (
            <p className="text-sm text-foreground/40 italic text-center py-8">
              Tickets will appear here after synthesis...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
