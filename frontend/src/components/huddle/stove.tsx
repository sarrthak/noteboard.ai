"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useSession } from "next-auth/react";
import { useHuddleStore, KanbanTicket, KanbanColumns } from "@/store/useHuddleStore";
import { API_BASE_URL } from "@/lib/api";
import { useActivityStore } from "@/store/useActivityStore";

interface ColumnConfig {
  id: keyof KanbanColumns;
  title: string;
  headerColor: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: "todo", title: "TO DO", headerColor: "text-[#EFD30B]" },
  { id: "inProgress", title: "IN PROGRESS", headerColor: "text-foreground/60" },
  { id: "review", title: "DONE", headerColor: "text-foreground/60" },
];

// Map backend status to column ID
const STATUS_TO_COLUMN: Record<string, keyof KanbanColumns> = {
  open: "todo",
  in_progress: "inProgress",
  done: "review",
  review: "review",
};

const COLUMN_TO_STATUS: Record<keyof KanbanColumns, string> = {
  todo: "open",
  inProgress: "in_progress",
  review: "done",
};

interface StoveProps {
  projectId?: string;
}

interface TicketApiResponse {
  id: string;
  title: string;
  description: string | null;
  business_value: string | null;
  type: string;
  priority: string;
  status: string;
}

export function Stove({ projectId }: StoveProps) {
  const { data: session } = useSession();
  const { columns, updateColumn, setColumns } = useHuddleStore();
  const logActivity = useActivityStore((state) => state.logActivity);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch tickets from backend on mount
  useEffect(() => {
    if (!projectId || !session?.accessToken) return;

    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/projects/${projectId}/tickets`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch tickets");
        }

        const data: TicketApiResponse[] = await response.json();

        // Organize tickets into columns based on status
        const newColumns: KanbanColumns = {
          todo: [],
          inProgress: [],
          review: [],
        };

        data.forEach((ticket) => {
          const columnId = STATUS_TO_COLUMN[ticket.status] || "todo";
          const kanbanTicket: KanbanTicket = {
            id: String(ticket.id),
            title: ticket.title,
            description: ticket.description || "",
            business_value: ticket.business_value || "",
            type: ticket.type,
            priority: ticket.priority,
          };
          newColumns[columnId].push(kanbanTicket);
        });

        setColumns(newColumns);
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [projectId, session?.accessToken, setColumns]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceColumnId = source.droppableId as keyof KanbanColumns;
    const destColumnId = destination.droppableId as keyof KanbanColumns;
    const previousColumns = {
      todo: [...columns.todo],
      inProgress: [...columns.inProgress],
      review: [...columns.review],
    };

    const sourceColumn = [...columns[sourceColumnId]];
    const destColumn =
      sourceColumnId === destColumnId ? sourceColumn : [...columns[destColumnId]];

    // Remove from source
    const [movedTicket] = sourceColumn.splice(source.index, 1);

    // Add to destination
    destColumn.splice(destination.index, 0, movedTicket);

    // Update columns
    if (sourceColumnId === destColumnId) {
      updateColumn(sourceColumnId, sourceColumn);
    } else {
      updateColumn(sourceColumnId, sourceColumn);
      updateColumn(destColumnId, destColumn);
    }

    if (!session?.accessToken || sourceColumnId === destColumnId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${movedTicket.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ status: COLUMN_TO_STATUS[destColumnId] }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist ticket status");
      }

      logActivity({
        message: `Moved \"${movedTicket.title}\" to ${destColumnId === "todo" ? "To Do" : destColumnId === "inProgress" ? "In Progress" : "Done"}`,
        href: projectId ? `/workspace/huddle?project=${projectId}` : "/workspace/huddle",
      });
    } catch (error) {
      setColumns(previousColumns);
      console.error("Failed to update ticket status:", error);
    }
  };

  const getBorderColor = (type?: string) => {
    switch (type) {
      case "bug":
        return "border-l-red-500";
      case "feature":
        return "border-l-[#EFD30B]";
      case "task":
        return "border-l-blue-500";
      case "improvement":
        return "border-l-purple-500";
      default:
        return "border-l-[#EFD30B]";
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-4 lg:p-6 overflow-hidden">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-foreground/60">Loading tickets...</div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex-1 flex flex-nowrap gap-4 lg:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory lg:snap-none">
            {COLUMNS.map((column) => (
              <div
                key={column.id}
                className="flex-shrink-0 min-w-[85vw] md:min-w-[300px] lg:min-w-0 lg:flex-1 flex flex-col snap-center"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className={`text-xs font-semibold tracking-wider ${column.headerColor}`}>
                    {column.title}
                  </h3>
                  <span className="text-xs text-foreground/40">
                    {columns[column.id].length}
                  </span>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        flex-1 rounded-lg p-2 space-y-3 overflow-y-auto
                        transition-colors duration-200 min-h-[200px]
                        ${
                          snapshot.isDraggingOver
                            ? "bg-[#EFD30B]/5 border border-dashed border-[#EFD30B]/30"
                            : "bg-transparent"
                        }
                      `}
                    >
                      {columns[column.id].map((ticket, index) => (
                        <Draggable
                          key={ticket.id}
                          draggableId={ticket.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`
                                bg-[#2A2A28] rounded-lg p-4 border-l-4
                                ${getBorderColor(ticket.type)}
                                ${
                                  snapshot.isDragging
                                    ? "shadow-xl shadow-black/40 rotate-1 scale-105"
                                    : ""
                                }
                                transition-all duration-200
                                hover:bg-[#333331] cursor-grab active:cursor-grabbing
                              `}
                            >
                              {/* Ticket Title */}
                              <h4 className="font-bold text-foreground text-sm leading-tight mb-2">
                                {ticket.title}
                              </h4>

                              {/* Business Value */}
                              {ticket.business_value && (
                                <p className="text-xs text-foreground/50 italic line-clamp-2">
                                  {ticket.business_value}
                                </p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty State */}
                      {columns[column.id].length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center h-24 text-foreground/20 text-xs uppercase tracking-wide">
                          Drop here
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
