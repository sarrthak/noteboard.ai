"""
Ticket model for storing project tickets/tasks.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TicketType(str, enum.Enum):
    """Ticket type enumeration."""
    FEATURE = "feature"
    BUG = "bug"
    TASK = "task"
    IMPROVEMENT = "improvement"


class TicketStatus(str, enum.Enum):
    """Ticket status enumeration."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"
    CLOSED = "closed"


class TicketPriority(str, enum.Enum):
    """Ticket priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Ticket(Base, UUIDMixin, TimestampMixin):
    """Ticket model for project tasks and features."""

    __tablename__ = "tickets"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[TicketType] = mapped_column(
        Enum(TicketType, values_callable=lambda x: [e.value for e in x]),
        default=TicketType.FEATURE,
        nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, values_callable=lambda x: [e.value for e in x]),
        default=TicketStatus.OPEN,
        nullable=False
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, values_callable=lambda x: [e.value for e in x]),
        default=TicketPriority.MEDIUM,
        nullable=False
    )

    # Foreign Keys
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Relationships
    project = relationship("Project", back_populates="tickets")
    creator = relationship("User", foreign_keys=[creator_id], backref="created_tickets")
    assignee = relationship("User", foreign_keys=[assignee_id], backref="assigned_tickets")

    def __repr__(self) -> str:
        return f"<Ticket {self.title}>"
