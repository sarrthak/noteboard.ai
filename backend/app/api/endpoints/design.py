"""
Design API endpoint for generating architecture diagrams.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.services.ai import ai_service
from app.services.knowledge_graph import knowledge_graph_service

router = APIRouter(prefix="/design", tags=["Design"])


# ---------- Schemas ----------

class DesignRequest(BaseModel):
    """Input for HLD generation."""
    ticket_id: str
    additional_context: str | None = None


class DesignResponse(BaseModel):
    """Output containing the Mermaid diagram code."""
    mermaid_code: str


# ---------- Endpoint ----------

@router.post("/generate_hld", response_model=DesignResponse)
async def generate_hld(
    request: DesignRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DesignResponse:
    """
    Generate a High-Level Design (HLD) diagram in Mermaid.js syntax
    for a given ticket.
    """
    # 1. Parse & validate ticket ID
    try:
        ticket_uuid = UUID(request.ticket_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ticket_id format",
        )

    # 2. Fetch ticket (scoped to current user via project ownership)
    result = await db.execute(
        select(Ticket)
        .join(Project, Ticket.project_id == Project.id)
        .where(
            Ticket.id == ticket_uuid,
            Project.owner_id == current_user.id,
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    # 3. Fetch dependency context from Neo4j (best-effort)
    dependency_context = ""
    try:
        deps = await knowledge_graph_service.get_capability_dependencies(
            str(ticket.id)
        )
        if deps:
            lines = []
            for d in deps:
                direction = d.get("direction", "related")
                rel = d.get("relationship", "RELATED_TO")
                name = d.get("name", "")
                if direction == "depends_on":
                    lines.append(f"- This capability {rel} → {name}")
                else:
                    lines.append(f"- {name} {rel} → this capability")
            dependency_context = (
                "\n\nKnowledge-Graph relationships:\n" + "\n".join(lines)
            )
    except Exception as e:
        logger.warning(f"Could not fetch graph dependencies (non-critical): {e}")

    # 4. Build the prompt and call OpenAI
    additional = (
        f"\n\nAdditional context from the user:\n{request.additional_context}"
        if request.additional_context
        else ""
    )

    system_prompt = (
        "You are an expert Software Architect. "
        "Generate a High-Level Design (HLD) diagram using Mermaid.js syntax "
        "(graph TD) for the following requirement. "
        "Only output the raw Mermaid code, no explanation or markdown fences."
    )

    user_message = (
        f"Ticket: {ticket.title}\n"
        f"Description: {ticket.description or 'N/A'}\n"
        f"Type: {ticket.type.value}\n"
        f"Business value: {ticket.business_value or 'N/A'}"
        f"{dependency_context}"
        f"{additional}"
    )

    try:
        response = await ai_service.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
        )

        mermaid_code = (response.choices[0].message.content or "").strip()

        # Strip accidental markdown fences the model sometimes adds
        if mermaid_code.startswith("```"):
            mermaid_code = mermaid_code.split("\n", 1)[-1]
        if mermaid_code.endswith("```"):
            mermaid_code = mermaid_code.rsplit("```", 1)[0].strip()

        if not mermaid_code:
            raise ValueError("Model returned empty diagram")

        return DesignResponse(mermaid_code=mermaid_code)

    except Exception as e:
        logger.error(f"HLD generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate design diagram. Please try again.",
        )
