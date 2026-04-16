import { create } from "zustand";

export interface DraftTicket {
  title: string;
  description: string;
  business_value: string;
  additional_context?: string;
  priority?: string;
  type?: string;
  dependencies?: string[];  // Legacy support
  depends_on?: string[];    // Hard dependencies
  related_to?: string[];    // Thematic relationships
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

// Knowledge Graph types
export interface GraphNode {
  id: string;
  name: string;
  group: string;
  description?: string;
  business_value?: string;
  type?: string;
  ticket_id?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface HuddleState {
  // State
  isRecording: boolean;
  transcript: string;
  draftTickets: DraftTicket[];
  columns: KanbanColumns;
  graphData: GraphData;

  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  setTranscript: (text: string) => void;
  addDraftTicket: (ticket: DraftTicket) => void;
  removeDraftTicket: (index: number) => void;
  setDraftTickets: (tickets: DraftTicket[]) => void;
  updateDraftTicket: (index: number, updates: Partial<DraftTicket>) => void;
  approveTicket: (index: number) => void;
  updateColumn: (columnId: keyof KanbanColumns, tickets: KanbanTicket[]) => void;
  setColumns: (columns: KanbanColumns) => void;
  moveTicket: (
    fromColumn: keyof KanbanColumns,
    toColumn: keyof KanbanColumns,
    ticketId: string
  ) => void;
  // Graph actions
  setGraphData: (data: GraphData) => void;
  addCapabilities: (tickets: Array<{ 
    id: string; 
    title: string; 
    description?: string; 
    business_value?: string; 
    type?: string; 
    dependencies?: string[];  // Legacy
    depends_on?: string[];    // Hard dependencies
    related_to?: string[];    // Thematic relationships
  }>) => void;
  clearGraph: () => void;
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
  graphData: {
    nodes: [],
    links: [],
  },
};

export const useHuddleStore = create<HuddleState>((set) => ({
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

  updateDraftTicket: (index: number, updates: Partial<DraftTicket>) =>
    set((state) => ({
      draftTickets: state.draftTickets.map((ticket, i) =>
        i === index ? { ...ticket, ...updates } : ticket
      ),
    })),

  approveTicket: (index: number) =>
    set((state) => {
      const ticket = state.draftTickets[index];
      if (!ticket) return state;

      // Create a Kanban ticket with a unique ID
      const kanbanTicket: KanbanTicket = {
        ...ticket,
        id: crypto.randomUUID(),
        type: (ticket.type as KanbanTicket["type"]) || "feature",
        priority: (ticket.priority as KanbanTicket["priority"]) || "medium",
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

  // Graph actions
  setGraphData: (data: GraphData) => set({ graphData: data }),

  addCapabilities: (tickets) =>
    set((state) => {
      const existingNodeIds = new Set(state.graphData.nodes.map((n) => n.id));
      const existingLinkKeys = new Set(
        state.graphData.links.map((l) => `${l.source}-${l.target}-${l.type}`)
      );

      const newNodes: GraphNode[] = [];
      const newLinks: GraphLink[] = [];

      for (const ticket of tickets) {
        // Add node if it doesn't exist
        if (!existingNodeIds.has(ticket.title)) {
          newNodes.push({
            id: ticket.title,
            name: ticket.title,
            group: "capability",
            description: ticket.description,
            business_value: ticket.business_value,
            type: ticket.type || "feature",
            ticket_id: ticket.id,
          });
          existingNodeIds.add(ticket.title);
        }

        // Merge legacy 'dependencies' with 'depends_on'
        const dependsOn = [
          ...(ticket.depends_on || []),
          ...(ticket.dependencies || []),
        ];

        // Add DEPENDS_ON links (hard dependencies)
        for (const dep of dependsOn) {
          const linkKey = `${ticket.title}-${dep}-DEPENDS_ON`;
          if (!existingLinkKeys.has(linkKey)) {
            newLinks.push({
              source: ticket.title,
              target: dep,
              type: "DEPENDS_ON",
            });
            existingLinkKeys.add(linkKey);

            // Also add the dependency as a node if it doesn't exist
            if (!existingNodeIds.has(dep)) {
              newNodes.push({
                id: dep,
                name: dep,
                group: "capability",
                type: "feature",
              });
              existingNodeIds.add(dep);
            }
          }
        }

        // Add RELATED_TO links (thematic relationships)
        if (ticket.related_to) {
          for (const rel of ticket.related_to) {
            const linkKey = `${ticket.title}-${rel}-RELATED_TO`;
            const reverseLinkKey = `${rel}-${ticket.title}-RELATED_TO`;
            // Only add if neither direction exists (avoid duplicates for bidirectional)
            if (!existingLinkKeys.has(linkKey) && !existingLinkKeys.has(reverseLinkKey)) {
              newLinks.push({
                source: ticket.title,
                target: rel,
                type: "RELATED_TO",
              });
              existingLinkKeys.add(linkKey);

              // Also add the related node if it doesn't exist
              if (!existingNodeIds.has(rel)) {
                newNodes.push({
                  id: rel,
                  name: rel,
                  group: "capability",
                  type: "feature",
                });
                existingNodeIds.add(rel);
              }
            }
          }
        }
      }

      return {
        graphData: {
          nodes: [...state.graphData.nodes, ...newNodes],
          links: [...state.graphData.links, ...newLinks],
        },
      };
    }),

  clearGraph: () =>
    set({
      graphData: { nodes: [], links: [] },
    }),

  reset: () => set(initialState),
}));
