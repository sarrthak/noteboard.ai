"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronDown,
  FolderKanban,
  Plus,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { clsx } from "clsx";

// Mock projects for demo - in real app, fetch from API
const mockProjects = [
  { id: "1", name: "noteboard.ai" },
  { id: "2", name: "Project Alpha" },
  { id: "3", name: "Mobile App" },
];

export function Topbar() {
  const { data: session } = useSession();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(mockProjects[0]);

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

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

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-[60px] bg-background border-b border-foreground/10 flex items-center justify-between px-6">
      {/* Left: Project Switcher */}
      <div className="relative" ref={projectDropdownRef}>
        <button
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded-sm transition-colors",
            "hover:bg-foreground/5 text-foreground"
          )}
        >
          <FolderKanban className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{selectedProject.name}</span>
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
              {mockProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProject(project);
                    setProjectDropdownOpen(false);
                  }}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm transition-colors",
                    selectedProject.id === project.id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-foreground/5"
                  )}
                >
                  <FolderKanban className="w-4 h-4" />
                  {project.name}
                </button>
              ))}
            </div>
            <div className="border-t border-foreground/10 p-2">
              <button className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: User Profile */}
      <div className="relative" ref={userDropdownRef}>
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
