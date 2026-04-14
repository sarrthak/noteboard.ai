from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.database import AsyncSessionLocal
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.services.langgraph_agent import run_dev_agent
from app.services.redis import redis_service
from app.websockets.manager import dev_ws_manager

router = APIRouter(prefix="/dev", tags=["dev"])


class ApproveCheckpointRequest(BaseModel):
    step: str

    @field_validator("step")
    @classmethod
    def validate_step(cls, v: str) -> str:
        if v not in ("plan", "draft", "verify"):
            raise ValueError("step must be one of: plan, draft, verify")
        return v


@router.websocket("/ws/{ticket_id}")
async def dev_websocket(websocket: WebSocket, ticket_id: str):
    await dev_ws_manager.connect(websocket, ticket_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dev_ws_manager.disconnect(websocket, ticket_id)


async def _get_owned_ticket(
    ticket_id: str,
    owner_id: UUID,
    db: AsyncSession,
) -> Ticket:
    try:
        ticket_uuid = UUID(ticket_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        ) from exc

    result = await db.execute(
        select(Ticket, Project.owner_id)
        .join(Project, Ticket.project_id == Project.id)
        .where(Ticket.id == ticket_uuid)
    )
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    ticket, project_owner_id = row
    if project_owner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this ticket",
        )

    return ticket


@router.post("/start_build/{ticket_id}")
async def start_build(
    ticket_id: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    owned_ticket = await _get_owned_ticket(ticket_id, current_user.id, db)
    background_tasks.add_task(_run_dev_agent_task, str(owned_ticket.id))
    return {"status": "started", "ticket_id": str(owned_ticket.id)}


async def _run_dev_agent_task(ticket_id: str) -> None:
    async with AsyncSessionLocal() as db_session:
        await run_dev_agent(ticket_id=ticket_id, db_session=db_session)


@router.post("/approve_checkpoint/{ticket_id}")
async def approve_checkpoint(
    ticket_id: str,
    body: ApproveCheckpointRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_ticket(ticket_id, current_user.id, db)
    checkpoint_key = f"checkpoint:{ticket_id}"
    await redis_service.set(checkpoint_key, f"approved_{body.step}")
    return {"status": "approved", "step": body.step, "ticket_id": ticket_id}
