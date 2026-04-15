"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ChevronDown,
  FolderKanban,
  Plus,
  LogOut,
  Settings,
  User,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useProjectStore } from "@/store/useProjectStore";
import { useModelConfigStore } from "@/store/useModelConfigStore";
import { navItems } from "@/components/sidebar";

export function Topbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);
  
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
    <>
    <header className="h-[60px] bg-background border-b border-foreground/10 flex items-center justify-between px-4 md:px-6 gap-2 md:gap-4">
      {/* Mobile Hamburger */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-sm text-foreground hover:bg-foreground/5 transition-colors shrink-0"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Left: Project Switcher */}
      <div className="relative shrink-0 min-w-0" ref={projectDropdownRef}>
        <button
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded-sm transition-colors min-w-0",
            "hover:bg-foreground/5 text-foreground"
          )}
        >
          <FolderKanban className="w-4 h-4 text-primary shrink-0" />
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">
              {selectedProject?.name || "Select Project"}
            </span>
          )}
          <ChevronDown
            className={clsx(
              "w-4 h-4 text-muted-foreground transition-transform shrink-0",
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

    {/* Mobile Navigation Drawer */}
    <AnimatePresence>
      {mobileDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-[#1A1A19] border-r border-foreground/10 flex flex-col md:hidden"
          >
            {/* Drawer header */}
            <div className="h-[60px] flex items-center justify-between px-4 border-b border-foreground/10">
              <Link href="/workspace" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-background font-bold text-lg">N</span>
                </div>
                <span className="font-semibold text-foreground">
                  noteboard<span className="text-primary">.ai</span>
                </span>
              </Link>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-3 rounded-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <Icon
                      className={clsx(
                        "w-5 h-5 shrink-0",
                        isActive && "drop-shadow-[0_0_8px_rgba(239,211,11,0.5)]"
                      )}
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer footer */}
            <div className="p-4 border-t border-foreground/10">
              <p className="text-xs text-muted-foreground">© 2026 noteboard.ai</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
