"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  Plus,
  LogOut,
  Settings,
  User,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { useProjectStore } from "@/store/useProjectStore";
import { useModelConfigStore } from "@/store/useModelConfigStore";

export function Topbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  
  const { projects, selectedProjectId, selectProject, fetchProjects, isLoading } = useProjectStore();
  const {
    catalog,
    selectedVendor,
    selectedModel,
    isLoading: modelsLoading,
    error: modelCatalogError,
    fetchCatalog,
    setSelectedVendor,
    setSelectedModel,
  } = useModelConfigStore();
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const selectedVendorModels = catalog.find((vendor) => vendor.key === selectedVendor)?.models ?? [];

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects on mount
  useEffect(() => {
    if (session?.accessToken && projects.length === 0) {
      fetchProjects(session.accessToken);
    }
  }, [session?.accessToken, fetchProjects, projects.length]);

  useEffect(() => {
    if (
      !session?.accessToken ||
      modelsLoading ||
      catalog.length > 0 ||
      Boolean(modelCatalogError)
    ) {
      return;
    }
    void fetchCatalog(session.accessToken);
  }, [session?.accessToken, modelsLoading, catalog.length, modelCatalogError, fetchCatalog]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target as Node)
      ) {
        setProjectDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    setProjectDropdownOpen(false);
    // Update URL if on huddle page
    if (pathname?.includes('/huddle')) {
      router.push(`${pathname}?project=${projectId}`);
    }
  };

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-[60px] bg-background border-b border-foreground/10 flex items-center justify-between px-6 gap-4">
      {/* Left: Project Switcher */}
      <div className="relative shrink-0" ref={projectDropdownRef}>
        <button
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded-sm transition-colors",
            "hover:bg-foreground/5 text-foreground"
          )}
        >
          <FolderKanban className="w-4 h-4 text-primary" />
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="font-medium text-sm">
              {selectedProject?.name || "Select Project"}
            </span>
          )}
          <ChevronDown
            className={clsx(
              "w-4 h-4 text-muted-foreground transition-transform",
              projectDropdownOpen && "rotate-180"
            )}
          />
        </button>

        {/* Project Dropdown */}
        {projectDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-muted border border-foreground/10 rounded-sm shadow-lg z-50">
            <div className="p-2">
              <p className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wide">
                Projects
              </p>
              {projects.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  No projects yet
                </p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    className={clsx(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm transition-colors",
                      selectedProjectId === project.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <FolderKanban className="w-4 h-4" />
                    {project.name}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-foreground/10 p-2">
              <button 
                onClick={() => router.push('/workspace/projects/new')}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Middle: Runtime Selection (Global) */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-2 border border-foreground/10 rounded-sm min-w-0 flex-1 max-w-3xl">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Runtime
        </span>

        <select
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
          disabled={modelsLoading || catalog.length === 0}
          className="min-w-[150px] px-2 py-1.5 rounded-sm bg-muted border border-foreground/10 text-xs text-foreground focus:outline-none"
        >
          {modelsLoading && <option value="">Loading vendors...</option>}
          {!modelsLoading && catalog.length === 0 && (
            <option value="">No vendors</option>
          )}
          {catalog.map((vendor) => (
            <option key={vendor.key} value={vendor.key}>
              {vendor.label}
            </option>
          ))}
        </select>

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={modelsLoading || selectedVendorModels.length === 0}
          className="min-w-0 flex-1 px-2 py-1.5 rounded-sm bg-muted border border-foreground/10 text-xs text-foreground focus:outline-none"
        >
          {modelsLoading && <option value="">Loading models...</option>}
          {!modelsLoading && selectedVendorModels.length === 0 && (
            <option value="">No models</option>
          )}
          {selectedVendorModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right: User Profile */}
      <div className="relative shrink-0" ref={userDropdownRef}>
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-primary/20 border border-primary/30 rounded-full flex items-center justify-center">
            <span className="text-primary text-sm font-medium">
              {userInitial}
            </span>
          </div>
        </button>

        {/* User Dropdown */}
        {userDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-56 bg-muted border border-foreground/10 rounded-sm shadow-lg z-50">
            <div className="p-3 border-b border-foreground/10">
              <p className="text-sm font-medium text-foreground truncate">
                {session?.user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
            <div className="p-2">
              <button className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm text-foreground hover:bg-foreground/5 transition-colors">
                <User className="w-4 h-4" />
                Profile
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm text-foreground hover:bg-foreground/5 transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
            <div className="border-t border-foreground/10 p-2">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
