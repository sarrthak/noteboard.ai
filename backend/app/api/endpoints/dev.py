from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel, field_validator

from app.services.agent_simulator import run_mock_agent
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


@router.post("/start_build/{ticket_id}")
async def start_build(ticket_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_mock_agent, ticket_id)
    return {"status": "started", "ticket_id": ticket_id}


@router.post("/approve_checkpoint/{ticket_id}")
async def approve_checkpoint(ticket_id: str, body: ApproveCheckpointRequest):
    checkpoint_key = f"checkpoint:{ticket_id}"
    await redis_service.set(checkpoint_key, f"approved_{body.step}")
    return {"status": "approved", "step": body.step, "ticket_id": ticket_id}
