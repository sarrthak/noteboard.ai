from typing import Annotated
from uuid import UUID
import os

import httpx
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


TARGET_VENDOR_LABELS: dict[str, str] = {
    "deepseek": "DeepSeek",
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "gemini": "Google",
    "zai": "ZAI",
    "qwen": "Qwen",
    "saravam": "Saravam",
}

TARGET_VENDOR_PREFIXES: dict[str, tuple[str, ...]] = {
    "deepseek": ("deepseek/",),
    "anthropic": ("anthropic/",),
    "openai": ("openai/",),
    "gemini": ("google/",),
    "zai": ("z-ai/", "zai/"),
    "qwen": ("qwen/",),
    "saravam": ("saravam/", "sarvam/", "sarvam-ai/"),
}


class ApproveCheckpointRequest(BaseModel):
    step: str

    @field_validator("step")
    @classmethod
    def validate_step(cls, v: str) -> str:
        if v not in ("plan", "draft", "verify"):
            raise ValueError("step must be one of: plan, draft, verify")
        return v


class StartBuildRequest(BaseModel):
    vendor: str = "openai"
    model: str = "gpt-4o"

    @field_validator("vendor")
    @classmethod
    def validate_vendor(cls, v: str) -> str:
        vendor = v.strip().lower()
        if vendor not in TARGET_VENDOR_LABELS:
            allowed = ", ".join(TARGET_VENDOR_LABELS.keys())
            raise ValueError(f"vendor must be one of: {allowed}")
        return vendor

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        model = v.strip()
        if not model:
            raise ValueError("model is required")
        return model


def _classify_vendor(model_id: str) -> str | None:
    normalized_id = model_id.strip().lower()
    for vendor_key, prefixes in TARGET_VENDOR_PREFIXES.items():
        if any(normalized_id.startswith(prefix) for prefix in prefixes):
            return vendor_key
    return None


def _build_models_payload(rows: list[dict]) -> dict:
    grouped: dict[str, dict[str, dict[str, str]]] = {
        vendor: {} for vendor in TARGET_VENDOR_LABELS
    }

    for row in rows:
        model_id = str(row.get("id", "")).strip()
        if not model_id:
            continue

        vendor_key = _classify_vendor(model_id)
        if not vendor_key:
            continue

        model_name = str(row.get("name") or model_id)
        grouped[vendor_key][model_id] = {
            "id": model_id,
            "name": model_name,
        }

    vendors_payload = []
    for vendor_key, label in TARGET_VENDOR_LABELS.items():
        models = sorted(
            grouped[vendor_key].values(),
            key=lambda item: item["name"].lower(),
        )
        vendors_payload.append(
            {
                "key": vendor_key,
                "label": label,
                "models": models,
            }
        )

    return {"vendors": vendors_payload}


@router.get("/models")
async def list_dev_models(
    current_user: Annotated[User, Depends(get_current_user)],
):
    _ = current_user

    cache_key = "dev:model_catalog:openrouter:v1"
    cached_payload = await redis_service.get_json(cache_key)
    if cached_payload:
        return cached_payload

    headers: dict[str, str] = {}
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        headers["Authorization"] = f"Bearer {openrouter_key}"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers=headers,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch model catalog from OpenRouter",
        ) from exc

    payload = response.json() if response.content else {}
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        rows = []

    models_payload = _build_models_payload(rows)
    await redis_service.set_json(cache_key, models_payload, expire=600)
    return models_payload


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
    body: StartBuildRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    owned_ticket = await _get_owned_ticket(ticket_id, current_user.id, db)
    background_tasks.add_task(
        _run_dev_agent_task,
        str(owned_ticket.id),
        body.vendor,
        body.model,
    )
    return {
        "status": "started",
        "ticket_id": str(owned_ticket.id),
        "vendor": body.vendor,
        "model": body.model,
    }


async def _run_dev_agent_task(ticket_id: str, vendor: str, model: str) -> None:
    async with AsyncSessionLocal() as db_session:
        await run_dev_agent(
            ticket_id=ticket_id,
            db_session=db_session,
            vendor=vendor,
            model=model,
        )


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
