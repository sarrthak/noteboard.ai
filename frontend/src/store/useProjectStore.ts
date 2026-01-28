import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (projectId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getSelectedProject: () => Project | undefined;
  fetchProjects: (accessToken: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null,

      setProjects: (projects) => set({ projects }),

      selectProject: (projectId) => set({ selectedProjectId: projectId }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      getSelectedProject: () => {
        const { projects, selectedProjectId } = get();
        return projects.find((p) => p.id === selectedProjectId);
      },

      fetchProjects: async (accessToken: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/projects`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error("Failed to fetch projects");
          }

          const data = await response.json();
          set({ projects: data, isLoading: false });

          // Auto-select first project if none selected
          const { selectedProjectId } = get();
          if (!selectedProjectId && data.length > 0) {
            set({ selectedProjectId: data[0].id });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "project-storage",
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
      }),
    }
  )
);
