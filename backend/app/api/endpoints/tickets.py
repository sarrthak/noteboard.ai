from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketOut, TicketUpdate

router = APIRouter()


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Ticket:
    """Get a single ticket by ID."""
    result = await db.execute(
        select(Ticket)
        .join(Project, Ticket.project_id == Project.id)
        .where(
            Ticket.id == ticket_id,
            Project.owner_id == current_user.id,
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    return ticket


@router.put("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: UUID,
    ticket_update: TicketUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Ticket:
    """Update a ticket by ID."""
    result = await db.execute(
        select(Ticket)
        .join(Project, Ticket.project_id == Project.id)
        .where(
            Ticket.id == ticket_id,
            Project.owner_id == current_user.id,
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    update_data = ticket_update.model_dump(exclude_unset=True)

    business_value_metric = update_data.pop("business_value_metric", None)
    if business_value_metric is not None:
        ticket.business_value = business_value_metric

    for field, value in update_data.items():
        if field == "business_value":
            ticket.business_value = value
        else:
            setattr(ticket, field, value)

    await db.commit()
    await db.refresh(ticket)

    return ticket