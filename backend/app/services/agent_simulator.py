import asyncio

from loguru import logger

from app.services.redis import redis_service
from app.websockets.manager import dev_ws_manager


async def run_mock_agent(ticket_id: str):
    """Simulate a LangGraph agent with plan → draft → verify phases."""

    checkpoint_key = f"checkpoint:{ticket_id}"

    # ── 1. Plan Phase ──────────────────────────────────────────────
    await dev_ws_manager.broadcast_to_ticket(ticket_id, {
        "step": "plan",
        "status": "running",
        "log": "Analyzing architecture...",
    })
    await asyncio.sleep(2)

    await dev_ws_manager.broadcast_to_ticket(ticket_id, {
        "step": "plan",
        "status": "awaiting_approval",
        "log": "Plan drafted. Waiting for human approval.",
    })
    await redis_service.set(checkpoint_key, "waiting_plan")

    while True:
        val = await redis_service.get(checkpoint_key)
        if val == "approved_plan":
            break
        await asyncio.sleep(0.5)

    # ── 2. Draft Phase ─────────────────────────────────────────────
    await dev_ws_manager.broadcast_to_ticket(ticket_id, {
        "step": "draft",
        "status": "running",
        "log": "Approval received. Writing code...",
    })
    await asyncio.sleep(2)

    await dev_ws_manager.broadcast_to_ticket(ticket_id, {
        "step": "draft",
        "status": "awaiting_approval",
        "log": "Code written. Waiting for review.",
    })
    await redis_service.set(checkpoint_key, "waiting_draft")

    while True:
        val = await redis_service.get(checkpoint_key)
        if val == "approved_draft":
            break
        await asyncio.sleep(0.5)

    # ── 3. Verify Phase ────────────────────────────────────────────
    await dev_ws_manager.broadcast_to_ticket(ticket_id, {
        "step": "verify",
        "status": "running",
        "log": "Running tests... Passed!",
    })
    await redis_service.delete(checkpoint_key)

    logger.info(f"Mock agent completed for ticket {ticket_id}")
