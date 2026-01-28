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

interface ColumnConfig {
  id: keyof KanbanColumns;
  title: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: "todo", title: "Todo" },
  { id: "inProgress", title: "In Progress" },
  { id: "review", title: "Review" },
];

// Map backend status to column ID
const STATUS_TO_COLUMN: Record<string, keyof KanbanColumns> = {
  open: "todo",
  in_progress: "inProgress",
  review: "review",
};

interface StoveProps {
  projectId?: string;
}

export function Stove({ projectId }: StoveProps) {
  const { data: session } = useSession();
  const { columns, updateColumn, setColumns } = useHuddleStore();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch tickets from backend on mount
  useEffect(() => {
    if (!projectId || !session?.accessToken) return;

    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tickets`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch tickets");
        }

        const data = await response.json();

        // Organize tickets into columns based on status
        const newColumns: KanbanColumns = {
          todo: [],
          inProgress: [],
          review: [],
        };

        data.forEach((ticket: any) => {
          const columnId = STATUS_TO_COLUMN[ticket.status] || "todo";
          const kanbanTicket: KanbanTicket = {
            id: ticket.id,
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

  const handleDragEnd = (result: DropResult) => {
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
  };

  const getBorderColor = (type?: string) => {
    switch (type) {
      case "bug":
        return "border-l-red-500";
      case "feature":
        return "border-l-primary";
      case "task":
        return "border-l-blue-500";
      case "improvement":
        return "border-l-purple-500";
      default:
        return "border-l-primary";
    }
  };

  const getPriorityBadge = (priority?: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400",
      high: "bg-orange-500/20 text-orange-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-green-500/20 text-green-400",
    };
    return colors[priority || "medium"] || colors.medium;
  };

  return (
    <div className="flex-1 h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <h2 className="text-xl font-semibold text-foreground mb-6">The Stove</h2>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-foreground/60">Loading tickets...</div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <div
                key={column.id}
                className="flex-1 min-w-[280px] max-w-[350px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-medium text-foreground/80">
                    {column.title}
                  </h3>
                  <span className="text-xs text-foreground/50 bg-foreground/10 px-2 py-0.5 rounded-full">
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
                        flex-1 rounded-lg p-2 space-y-2 overflow-y-auto
                        transition-colors duration-200
                        ${
                          snapshot.isDraggingOver
                            ? "bg-primary/10 border-2 border-dashed border-primary/30"
                            : "bg-foreground/5 border border-foreground/10"
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
                                bg-[#2A2A28] rounded-lg p-3 border-l-4
                                ${getBorderColor(ticket.type)}
                                ${
                                  snapshot.isDragging
                                    ? "shadow-lg shadow-black/30 rotate-2"
                                    : ""
                                }
                                transition-shadow duration-200
                                hover:bg-[#333331] cursor-grab active:cursor-grabbing
                              `}
                            >
                              {/* Ticket Header */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-medium text-foreground text-sm leading-tight">
                                  {ticket.title}
                                </h4>
                                {ticket.priority && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0 ${getPriorityBadge(
                                      ticket.priority
                                    )}`}
                                  >
                                    {ticket.priority}
                                  </span>
                                )}
                              </div>

                              {/* Description */}
                              {ticket.description && (
                                <p className="text-xs text-foreground/50 line-clamp-2 mb-2">
                                  {ticket.description}
                                </p>
                              )}

                              {/* Business Value */}
                              {ticket.business_value && (
                                <div className="bg-primary/10 rounded px-2 py-1.5">
                                  <p className="text-xs text-primary font-medium line-clamp-2">
                                    💡 {ticket.business_value}
                                  </p>
                                </div>
                              )}

                              {/* Type Badge */}
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] text-foreground/40 uppercase tracking-wide">
                                  {ticket.type || "feature"}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty State */}
                      {columns[column.id].length === 0 && (
                        <div className="flex items-center justify-center h-24 text-foreground/30 text-sm">
                          Drop tickets here
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
