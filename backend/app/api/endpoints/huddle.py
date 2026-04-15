"""
Huddle API endpoints for audio transcription and ticket synthesis.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from loguru import logger
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.ticket import Ticket, TicketType
from app.models.user import User
from app.services.ai import AIConfigurationError, SUPPORTED_MODEL_VENDORS, ai_service
from app.services.knowledge_graph import knowledge_graph_service

router = APIRouter(prefix="/huddle", tags=["Huddle"])


# Request/Response Schemas
class TranscriptResponse(BaseModel):
    """Response for audio transcription."""
    text: str


class SynthesizeRequest(BaseModel):
    """Request for ticket synthesis."""
    transcript: str
    project_id: UUID
    vendor: str = "openai"
    model: str = "gpt-4o"

    @field_validator("vendor")
    @classmethod
    def validate_vendor(cls, v: str) -> str:
        vendor = v.strip().lower()
        if vendor not in SUPPORTED_MODEL_VENDORS:
            allowed = ", ".join(sorted(SUPPORTED_MODEL_VENDORS))
            raise ValueError(f"vendor must be one of: {allowed}")
        return vendor

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        model = v.strip()
        if not model:
            raise ValueError("model is required")
        return model


class SynthesizedTicket(BaseModel):
    """A synthesized ticket from AI."""
    title: str
    description: str
    business_value: str | None = None
    business_value_metric: str | None = None
    type: str  # "feature" or "bug"
    priority: str = "medium"  # "high", "medium", "low"
    dependencies: list[str] = []  # Legacy: List of capability names this depends on
    depends_on: list[str] = []    # Hard dependencies
    related_to: list[str] = []    # Thematic relationships

    @property
    def business_value_display(self) -> str:
        """Get business value from either field."""
        return self.business_value_metric or self.business_value or ""
    
    @property
    def all_dependencies(self) -> list[str]:
        """Get all dependencies (merged legacy + new)."""
        return list(set(self.dependencies + self.depends_on))


class SynthesizeResponse(BaseModel):
    """Response for ticket synthesis."""
    tickets: list[SynthesizedTicket]


class ConfirmTicket(BaseModel):
    """Ticket to be confirmed and saved."""
    title: str
    description: str
    business_value: str
    type: str
    priority: str = "medium"
    dependencies: list[str] = []  # Legacy: List of capability names this depends on
    depends_on: list[str] = []    # Hard dependencies
    related_to: list[str] = []    # Thematic relationships
    
    @property
    def all_dependencies(self) -> list[str]:
        """Get all dependencies (merged legacy + new)."""
        return list(set(self.dependencies + self.depends_on))


class ConfirmRequest(BaseModel):
    """Request to confirm and save tickets."""
    project_id: UUID
    tickets: list[ConfirmTicket]
    vendor: str = "openai"
    model: str = "gpt-4o"

    @field_validator("vendor")
    @classmethod
    def validate_vendor(cls, v: str) -> str:
        vendor = v.strip().lower()
        if vendor not in SUPPORTED_MODEL_VENDORS:
            allowed = ", ".join(sorted(SUPPORTED_MODEL_VENDORS))
            raise ValueError(f"vendor must be one of: {allowed}")
        return vendor

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        model = v.strip()
        if not model:
            raise ValueError("model is required")
        return model


class TicketResponse(BaseModel):
    """Response for a saved ticket."""
    id: UUID
    title: str
    description: str | None
    business_value: str | None
    type: str
    status: str
    priority: str

    model_config = {"from_attributes": True}


class ConfirmResponse(BaseModel):
    """Response for confirmed tickets."""
    message: str
    tickets: list[TicketResponse]


@router.post("/upload", response_model=TranscriptResponse)
async def upload_audio(
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TranscriptResponse:
    """
    Upload an audio file and get the transcribed text.
    
    Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
    """
    # Validate file type
    allowed_types = [
        "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", 
        "audio/webm", "audio/x-m4a", "video/mp4", "video/webm"
    ]
    
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {allowed_types}"
        )

    logger.info(f"User {current_user.email} uploading audio for transcription")
    
    try:
        text = await ai_service.transcribe_audio(file)
        return TranscriptResponse(text=text)
    except AIConfigurationError as e:
        logger.warning(f"Transcription unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI transcription is unavailable because the OpenAI provider is not configured",
        )
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to transcribe audio. Please try again."
        )


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_tickets(
    request: SynthesizeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SynthesizeResponse:
    """
    Analyze transcript and synthesize structured tickets using AI.
    """
    # Verify project access
    result = await db.execute(
        select(Project).where(
            Project.id == request.project_id,
            Project.owner_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    logger.info(f"Synthesizing tickets for project {project.name}")
    
    try:
        # Build project context
        project_context = f"Project: {project.name}"
        if project.description:
            project_context += f"\nDescription: {project.description}"
        
        result = await ai_service.synthesize_tickets(
            transcript=request.transcript,
            project_context=project_context,
            vendor=request.vendor,
            model=request.model,
        )
        
        tickets = [
            SynthesizedTicket(
                title=t.get("title", "Untitled"),
                description=t.get("description", ""),
                business_value=t.get("business_value", ""),
                type=t.get("type", "feature"),
                priority=t.get("priority", "medium"),
                dependencies=t.get("dependencies", []),  # Legacy
                depends_on=t.get("depends_on", []),      # New
                related_to=t.get("related_to", []),      # New
            )
            for t in result.get("tickets", [])
        ]
        
        return SynthesizeResponse(tickets=tickets)

    except AIConfigurationError as e:
        logger.warning(f"Synthesis unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI synthesis is unavailable because the selected model provider is not configured",
        )
        
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to synthesize tickets. Please try again."
        )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_tickets(
    request: ConfirmRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConfirmResponse:
    """
    Confirm and save synthesized tickets to the database.
    """
    # Verify project access
    result = await db.execute(
        select(Project).where(
            Project.id == request.project_id,
            Project.owner_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    logger.info(f"Confirming {len(request.tickets)} tickets for project {project.name}")
    
    saved_tickets = []
    
    for ticket_data in request.tickets:
        # Map string type to enum
        ticket_type = TicketType.FEATURE
        if ticket_data.type.lower() == "bug":
            ticket_type = TicketType.BUG
        elif ticket_data.type.lower() == "task":
            ticket_type = TicketType.TASK
        
        ticket = Ticket(
            title=ticket_data.title,
            description=ticket_data.description,
            business_value=ticket_data.business_value,
            type=ticket_type,
            project_id=request.project_id,
            creator_id=current_user.id,
        )
        
        db.add(ticket)
        saved_tickets.append(ticket)
    
    await db.commit()
    
    # Refresh to get IDs
    for ticket in saved_tickets:
        await db.refresh(ticket)
    
    # Add capabilities to knowledge graph (non-blocking)
    new_capabilities = []
    project_id_str = str(request.project_id)
    
    for ticket in saved_tickets:
        capability_data = {
            "id": str(ticket.id),
            "title": ticket.title,
            "description": ticket.description,
            "business_value": ticket.business_value,
            "type": ticket.type.value,
            "project_id": project_id_str,
        }
        try:
            await knowledge_graph_service.add_capability(capability_data)
            new_capabilities.append(capability_data)
        except Exception as e:
            logger.warning(f"Failed to add capability to graph (non-critical): {e}")
    
    # Use AI to discover ALL relationships between capabilities
    # This is the primary method for building the Knowledge Graph
    if new_capabilities:
        try:
            # Get existing capabilities from the graph
            existing_capabilities = await knowledge_graph_service.get_existing_capabilities(project_id_str)
            # Filter out the ones we just added
            existing_only = [
                c for c in existing_capabilities 
                if c["name"] not in [nc["title"] for nc in new_capabilities]
            ]
            
            logger.info(f"Analyzing relationships: {len(new_capabilities)} new + {len(existing_only)} existing capabilities")
            
            # Let AI analyze ALL relationships between capabilities
            ai_relationships = await ai_service.analyze_capability_relationships(
                new_capabilities=new_capabilities,
                existing_capabilities=existing_only,
                vendor=request.vendor,
                model=request.model,
            )
            
            if ai_relationships:
                created = await knowledge_graph_service.add_relationships_batch(
                    ai_relationships, 
                    project_id_str
                )
                logger.info(f"AI discovered and created {created} relationships in Knowledge Graph")
            else:
                logger.info("AI found no relationships between capabilities")
                
        except Exception as e:
            logger.warning(f"Failed to analyze capability relationships (non-critical): {e}")
    
    logger.info(f"Saved {len(saved_tickets)} tickets successfully")
    
    return ConfirmResponse(
        message=f"Successfully created {len(saved_tickets)} tickets",
        tickets=[
            TicketResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                business_value=t.business_value,
                type=t.type.value,
                status=t.status.value,
                priority=t.priority.value
            )
            for t in saved_tickets
        ]
    )


# Graph response schemas
class GraphNode(BaseModel):
    """A node in the knowledge graph."""
    id: str
    name: str
    group: str  # "capability" or "project"
    description: str | None = None
    business_value: str | None = None
    type: str | None = None
    ticket_id: str | None = None


class GraphLink(BaseModel):
    """A link/edge in the knowledge graph."""
    source: str  # Node id (capability name)
    target: str  # Node id (capability name)
    type: str    # Relationship type: DEPENDS_ON, ENABLES, EXTENDS, RELATED_TO


class GraphResponse(BaseModel):
    """Response containing the project knowledge graph."""
    nodes: list[GraphNode]
    links: list[GraphLink]


@router.get("/graph/{project_id}", response_model=GraphResponse)
async def get_project_graph(
    project_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GraphResponse:
    """
    Get the knowledge graph for a project.
    
    Returns nodes (capabilities) and links (relationships) suitable for
    visualization with d3.js or react-force-graph.
    """
    # Verify project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    logger.info(f"Fetching knowledge graph for project {project.name}")
    
    try:
        graph_data = await knowledge_graph_service.get_project_graph(str(project_id))
        
        return GraphResponse(
            nodes=[GraphNode(**node) for node in graph_data.get("nodes", [])],
            links=[GraphLink(**link) for link in graph_data.get("links", [])]
        )
    except Exception as e:
        logger.error(f"Failed to fetch graph: {e}")
        # Return empty graph on error rather than failing
        return GraphResponse(nodes=[], links=[])
