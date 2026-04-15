import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_BASE_URL } from "@/lib/api";

export interface ModelCatalogEntry {
  id: string;
  name: string;
}

export interface ModelCatalogVendor {
  key: string;
  label: string;
  models: ModelCatalogEntry[];
}

interface ModelCatalogResponse {
  vendors: ModelCatalogVendor[];
}

interface ModelConfigState {
  catalog: ModelCatalogVendor[];
  isLoading: boolean;
  error: string | null;
  selectedVendor: string;
  selectedModel: string;

  fetchCatalog: (accessToken: string) => Promise<void>;
  setSelectedVendor: (vendor: string) => void;
  setSelectedModel: (model: string) => void;
  getSelectedVendorModels: () => ModelCatalogEntry[];
}

function resolveSelection(
  vendors: ModelCatalogVendor[],
  currentVendor: string,
  currentModel: string
): { vendor: string; model: string } {
  if (vendors.length === 0) {
    return { vendor: "", model: "" };
  }

  const nextVendor = vendors.some((vendor) => vendor.key === currentVendor)
    ? currentVendor
    : vendors[0].key;

  const vendorModels =
    vendors.find((vendor) => vendor.key === nextVendor)?.models ?? [];

  if (vendorModels.length === 0) {
    return { vendor: nextVendor, model: "" };
  }

  const nextModel = vendorModels.some((model) => model.id === currentModel)
    ? currentModel
    : vendorModels[0].id;

  return { vendor: nextVendor, model: nextModel };
}

export const useModelConfigStore = create<ModelConfigState>()(
  persist(
    (set, get) => ({
      catalog: [],
      isLoading: false,
      error: null,
      selectedVendor: "",
      selectedModel: "",

      fetchCatalog: async (accessToken: string) => {
        if (!accessToken) return;

        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_BASE_URL}/dev/models`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error("Failed to fetch model catalog");
          }

          const payload: ModelCatalogResponse = await response.json();
          const vendors = (payload.vendors ?? []).filter(
            (vendor) => Array.isArray(vendor.models) && vendor.models.length > 0
          );

          set((state) => {
            const selection = resolveSelection(
              vendors,
              state.selectedVendor,
              state.selectedModel
            );

            return {
              catalog: vendors,
              selectedVendor: selection.vendor,
              selectedModel: selection.model,
              isLoading: false,
              error: null,
            };
          });
        } catch (error) {
          set({
            catalog: [],
            selectedVendor: "",
            selectedModel: "",
            isLoading: false,
            error:
              error instanceof Error ? error.message : "Failed to load models",
          });
        }
      },

      setSelectedVendor: (vendor: string) => {
        set((state) => {
          const normalizedVendor = vendor.trim().toLowerCase();
          const vendorModels =
            state.catalog.find((item) => item.key === normalizedVendor)?.models ??
            [];

          const nextModel = vendorModels.some(
            (model) => model.id === state.selectedModel
          )
            ? state.selectedModel
            : (vendorModels[0]?.id ?? "");

          return {
            selectedVendor: normalizedVendor,
            selectedModel: nextModel,
          };
        });
      },

      setSelectedModel: (model: string) => {
        set({ selectedModel: model.trim() });
      },

      getSelectedVendorModels: () => {
        const { catalog, selectedVendor } = get();
        return (
          catalog.find((vendor) => vendor.key === selectedVendor)?.models ?? []
        );
      },
    }),
    {
      name: "model-config-storage",
      partialize: (state) => ({
        selectedVendor: state.selectedVendor,
        selectedModel: state.selectedModel,
      }),
    }
  )
);
