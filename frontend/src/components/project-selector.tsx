"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, FolderKanban, Check, Loader2 } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";

export function ProjectSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const {
    projects,
    selectedProjectId,
    isLoading,
    selectProject,
    fetchProjects,
    getSelectedProject,
  } = useProjectStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects on mount
  useEffect(() => {
    if (session?.accessToken && projects.length === 0) {
      fetchProjects(session.accessToken);
    }
  }, [session?.accessToken, fetchProjects, projects.length]);

  // Sync URL with selected project
  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (urlProjectId && urlProjectId !== selectedProjectId) {
      selectProject(urlProjectId);
    }
  }, [searchParams, selectedProjectId, selectProject]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: string) => {
    selectProject(projectId);
    setIsOpen(false);

    // Update URL with project ID
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedProject = getSelectedProject();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 
                   hover:bg-foreground/10 transition-colors border border-foreground/10
                   min-w-[200px]"
      >
        <FolderKanban className="w-4 h-4 text-[#EFD30B]" />
        <span className="flex-1 text-left text-sm text-foreground truncate">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : selectedProject ? (
            selectedProject.name
          ) : (
            <span className="text-foreground/50">Select a project</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-foreground/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[250px] 
                        bg-[#2A2A28] border border-foreground/10 rounded-lg 
                        shadow-xl shadow-black/30 z-50 overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto py-1">
            {projects.length === 0 ? (
              <div className="px-4 py-3 text-sm text-foreground/50 text-center">
                No projects found
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left
                             hover:bg-foreground/5 transition-colors
                             ${project.id === selectedProjectId ? "bg-foreground/10" : ""}`}
                >
                  <FolderKanban
                    className={`w-4 h-4 flex-shrink-0 ${
                      project.id === selectedProjectId
                        ? "text-[#EFD30B]"
                        : "text-foreground/40"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-foreground/50 truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {project.id === selectedProjectId && (
                    <Check className="w-4 h-4 text-[#EFD30B] flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
