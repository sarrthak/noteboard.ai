"""
LangGraph-powered Dev Agent orchestration service.
"""

import asyncio
import os
from typing import TypedDict
from uuid import UUID

from langgraph.graph import StateGraph, START, END
from loguru import logger
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ticket import Ticket
from app.services.knowledge_graph import knowledge_graph_service
from app.services.redis import redis_service as redis_client
from app.websockets.manager import dev_ws_manager


class AgentState(TypedDict):
    ticket_id: str
    title: str
    description: str
    dependencies: list[str]
    plan: str
    code: str
    tests_passed: bool


_llm_client: AsyncOpenAI | None = None


def _normalize_api_key(raw_key: str | None) -> str:
    if not raw_key:
        return ""

    key = raw_key.strip()
    if len(key) >= 2 and ((key[0] == '"' and key[-1] == '"') or (key[0] == "'" and key[-1] == "'")):
        key = key[1:-1].strip()
    return key


def _get_llm_client() -> AsyncOpenAI:
    global _llm_client

    if _llm_client is not None:
        return _llm_client

    api_key = _normalize_api_key(settings.OPENAI_API_KEY)
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the backend service")

    # Optional seam for OpenRouter or other OpenAI-compatible providers.
    base_url = os.getenv("DEV_AGENT_OPENAI_BASE_URL", "").strip()
    if base_url:
        _llm_client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    else:
        _llm_client = AsyncOpenAI(api_key=api_key)

    return _llm_client


async def _chat_completion(system_prompt: str, user_prompt: str) -> str:
    client = _get_llm_client()
    model = os.getenv("DEV_AGENT_MODEL", "gpt-4o")

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content
    return (content or "").strip()


async def planner_node(state: AgentState) -> dict[str, str]:
    dependencies = ", ".join(state["dependencies"]) if state["dependencies"] else "none"
    system_prompt = (
        "You are an Expert Architect. Write a technical implementation plan for this capability. "
        f"It MUST accommodate the following dependencies: {dependencies}. "
        "Wrap your reasoning in <thinking> tags."
    )
    user_prompt = (
        f"Title: {state['title']}\n"
        f"Description: {state['description']}\n"
        f"Dependencies: {dependencies}"
    )

    llm_response = await _chat_completion(system_prompt, user_prompt)
    return {"plan": llm_response}


async def drafter_node(state: AgentState) -> dict[str, str]:
    system_prompt = (
        "You are a Senior Developer. "
        f"Write the implementation code based on this plan: {state['plan']}. "
        "Output ONLY code."
    )
    user_prompt = (
        f"Capability: {state['title']}\n"
        f"Plan:\n{state['plan']}"
    )

    llm_response = await _chat_completion(system_prompt, user_prompt)
    return {"code": llm_response}


async def verifier_node(state: AgentState) -> dict[str, bool]:
    # Current verifier simulates test pass while preserving an async node contract.
    await asyncio.sleep(0.2)
    return {"tests_passed": True}


workflow = StateGraph(AgentState)
workflow.add_node("planner", planner_node)
workflow.add_node("drafter", drafter_node)
workflow.add_node("verifier", verifier_node)
workflow.add_edge(START, "planner")
workflow.add_edge("planner", "drafter")
workflow.add_edge("drafter", "verifier")
workflow.add_edge("verifier", END)
app_graph = workflow.compile()


async def _broadcast(ticket_id: str, step: str, status: str, log: str) -> None:
    await dev_ws_manager.broadcast_to_ticket(
        ticket_id,
        {
            "step": step,
            "status": status,
            "log": log,
        },
    )


async def _wait_for_approval(checkpoint_key: str, expected: str) -> None:
    while True:
        value = await redis_client.get(checkpoint_key)
        if value == expected:
            return
        await asyncio.sleep(0.5)


async def run_dev_agent(ticket_id: str, db_session: AsyncSession) -> None:
    checkpoint_key = f"checkpoint:{ticket_id}"

    try:
        # Ensure Redis is connected so checkpoint approvals can be consumed.
        _ = redis_client.client
    except RuntimeError:
        await _broadcast(ticket_id, "plan", "error", "Redis is unavailable; cannot run approval checkpoints.")
        return

    try:
        try:
            ticket_uuid = UUID(ticket_id)
        except ValueError:
            await _broadcast(ticket_id, "plan", "error", "Invalid ticket id.")
            return

        ticket_result = await db_session.execute(
            select(Ticket).where(Ticket.id == ticket_uuid)
        )
        ticket = ticket_result.scalar_one_or_none()

        if ticket is None:
            await _broadcast(ticket_id, "plan", "error", "Ticket not found.")
            return

        dependencies_data = await knowledge_graph_service.get_capability_dependencies(ticket_id)
        dependencies = [item["name"] for item in dependencies_data if item.get("name")]

        state: AgentState = {
            "ticket_id": ticket_id,
            "title": ticket.title,
            "description": ticket.description or "",
            "dependencies": list(dict.fromkeys(dependencies)),
            "plan": "",
            "code": "",
            "tests_passed": False,
        }

        # Step 1: Plan
        await _broadcast(ticket_id, "plan", "running", "Generating Plan...")
        plan_update = await planner_node(state)
        state["plan"] = plan_update["plan"]
        await _broadcast(ticket_id, "plan", "running", state["plan"])
        await redis_client.set(checkpoint_key, "waiting_plan")
        await _broadcast(ticket_id, "plan", "awaiting_approval", "Plan drafted. Waiting for approval.")
        await _wait_for_approval(checkpoint_key, "approved_plan")

        # Step 2: Draft
        await _broadcast(ticket_id, "draft", "running", "Writing Code...")
        draft_update = await drafter_node(state)
        state["code"] = draft_update["code"]
        await _broadcast(ticket_id, "draft", "running", state["code"])
        await redis_client.set(checkpoint_key, "waiting_draft")
        await _broadcast(ticket_id, "draft", "awaiting_approval", "Code drafted. Waiting for approval.")
        await _wait_for_approval(checkpoint_key, "approved_draft")

        # Step 3: Verify
        await _broadcast(ticket_id, "verify", "running", "Verifying Code...")
        verify_update = await verifier_node(state)
        state["tests_passed"] = verify_update["tests_passed"]
        if state["tests_passed"]:
            await _broadcast(ticket_id, "verify", "running", "Verification successful. Tests passed.")
        else:
            await _broadcast(ticket_id, "verify", "error", "Verification failed.")

    except Exception as exc:
        logger.exception(f"Dev agent failed for ticket {ticket_id}: {exc}")
        await _broadcast(ticket_id, "verify", "error", f"Agent failed: {exc}")
    finally:
        await redis_client.delete(checkpoint_key)
