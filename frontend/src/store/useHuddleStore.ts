import { create } from "zustand";

export interface DraftTicket {
  title: string;
  description: string;
  business_value: string;
}

export interface KanbanTicket extends DraftTicket {
  id: string;
  type?: "feature" | "bug" | "task" | "improvement";
  priority?: "low" | "medium" | "high" | "critical";
}

export interface KanbanColumns {
  todo: KanbanTicket[];
  inProgress: KanbanTicket[];
  review: KanbanTicket[];
}

interface HuddleState {
  // State
  isRecording: boolean;
  transcript: string;
  draftTickets: DraftTicket[];
  columns: KanbanColumns;

  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  setTranscript: (text: string) => void;
  addDraftTicket: (ticket: DraftTicket) => void;
  removeDraftTicket: (index: number) => void;
  setDraftTickets: (tickets: DraftTicket[]) => void;
  approveTicket: (index: number) => void;
  updateColumn: (columnId: keyof KanbanColumns, tickets: KanbanTicket[]) => void;
  setColumns: (columns: KanbanColumns) => void;
  moveTicket: (
    fromColumn: keyof KanbanColumns,
    toColumn: keyof KanbanColumns,
    ticketId: string
  ) => void;
  reset: () => void;
}

const initialState = {
  isRecording: false,
  transcript: "",
  draftTickets: [],
  columns: {
    todo: [],
    inProgress: [],
    review: [],
  },
};

export const useHuddleStore = create<HuddleState>((set, get) => ({
  ...initialState,

  startRecording: () => set({ isRecording: true }),

  stopRecording: () => set({ isRecording: false }),

  setTranscript: (text: string) => set({ transcript: text }),

  addDraftTicket: (ticket: DraftTicket) =>
    set((state) => ({
      draftTickets: [...state.draftTickets, ticket],
    })),

  removeDraftTicket: (index: number) =>
    set((state) => ({
      draftTickets: state.draftTickets.filter((_, i) => i !== index),
    })),

  setDraftTickets: (tickets: DraftTicket[]) =>
    set({ draftTickets: tickets }),

  approveTicket: (index: number) =>
    set((state) => {
      const ticket = state.draftTickets[index];
      if (!ticket) return state;

      // Create a Kanban ticket with a unique ID
      const kanbanTicket: KanbanTicket = {
        ...ticket,
        id: crypto.randomUUID(),
        type: "feature",
        priority: "medium",
      };

      return {
        draftTickets: state.draftTickets.filter((_, i) => i !== index),
        columns: {
          ...state.columns,
          todo: [...state.columns.todo, kanbanTicket],
        },
      };
    }),

  updateColumn: (columnId: keyof KanbanColumns, tickets: KanbanTicket[]) =>
    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: tickets,
      },
    })),

  setColumns: (columns: KanbanColumns) => set({ columns }),

  moveTicket: (
    fromColumn: keyof KanbanColumns,
    toColumn: keyof KanbanColumns,
    ticketId: string
  ) =>
    set((state) => {
      const ticket = state.columns[fromColumn].find((t) => t.id === ticketId);
      if (!ticket) return state;

      return {
        columns: {
          ...state.columns,
          [fromColumn]: state.columns[fromColumn].filter(
            (t) => t.id !== ticketId
          ),
          [toColumn]: [...state.columns[toColumn], ticket],
        },
      };
    }),

  reset: () => set(initialState),
}));
