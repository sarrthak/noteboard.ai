from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, computed_field


class TicketStatus(str, Enum):
    """Ticket status enumeration."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"
    CLOSED = "closed"


class TicketPriority(str, Enum):
    """Ticket priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketType(str, Enum):
    """Ticket type enumeration."""
    FEATURE = "feature"
    BUG = "bug"
    TASK = "task"
    IMPROVEMENT = "improvement"


class TicketBase(BaseModel):
    """Base schema for Ticket."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    status: TicketStatus = TicketStatus.OPEN
    priority: TicketPriority = TicketPriority.MEDIUM


class TicketCreate(TicketBase):
    """Schema for creating a new ticket."""
    project_id: UUID


class TicketUpdate(BaseModel):
    """Schema for updating a ticket."""
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    business_value: str | None = None
    business_value_metric: str | None = None
    type: TicketType | None = None
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: UUID | None = None


class TicketResponse(TicketBase):
    """Schema for ticket response."""
    id: UUID
    project_id: UUID
    creator_id: UUID
    assignee_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    """Output schema used by Kanban APIs."""
    id: UUID
    project_id: UUID
    creator_id: UUID
    assignee_id: UUID | None = None
    title: str
    description: str | None = None
    business_value: str | None = None
    type: str
    status: TicketStatus
    priority: TicketPriority
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def business_value_metric(self) -> str | None:
        return self.business_value

    model_config = {"from_attributes": True}
