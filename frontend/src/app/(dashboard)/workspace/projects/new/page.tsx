"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FolderPlus, Loader2 } from "lucide-react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAuthenticatedApi } from "@/lib/api";
import { Project, useProjectStore } from "@/store/useProjectStore";
import { useActivityStore } from "@/store/useActivityStore";

function extractError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return "Unexpected error while creating project.";
  }

  const detail = err.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const joined = detail
      .map((item: { msg?: string }) => item?.msg)
      .filter(Boolean)
      .join(" ");
    return joined || "Please check your input and try again.";
  }
  return "Could not initialize project. Please try again.";
}

export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const logActivity = useActivityStore((state) => state.logActivity);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) {
      setError("You must be signed in to create a project.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const api = createAuthenticatedApi(session.accessToken);

      const created = await api.post<Project>("/projects", {
        name,
        description: description.trim() || null,
      });

      const fresh = await api.get<Project>(`/projects/${created.data.id}`);
      setActiveProject(fresh.data);
      logActivity({
        message: `Created project \"${fresh.data.name}\"`,
        href: `/workspace/huddle?project=${fresh.data.id}`,
      });

      router.push("/workspace/huddle");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl border border-foreground/10 bg-black/30 backdrop-blur-md p-8 md:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-sm border border-[#EFD30B]/35 bg-[#EFD30B]/10 flex items-center justify-center">
            <FolderPlus className="w-5 h-5 text-[#EFD30B]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Initialize New Workspace
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create a project shell and jump straight into Huddle.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-foreground mb-2">
              Project Name
            </label>
            <Input
              id="project-name"
              type="text"
              placeholder="ex: Payments Modernization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              error={!!error}
            />
          </div>

          <div>
            <label htmlFor="project-description" className="block text-sm font-medium text-foreground mb-2">
              Description (Optional)
            </label>
            <textarea
              id="project-description"
              placeholder="Add context, goals, or architectural focus for this workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-transparent px-4 py-3 border border-foreground/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={isLoading}
            className={`w-full mt-3 bg-[#EFD30B] text-[#1A1A19] hover:bg-[#EFD30B]/90 ${
              isLoading ? "animate-pulse" : ""
            }`}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing Project...
              </span>
            ) : (
              "Initialize Project"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}