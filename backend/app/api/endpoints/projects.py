from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.ticket import TicketOut
from app.services.redis import redis_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Project:
    """
    Create a new project.
    
    - **name**: Project name (required)
    - **description**: Project description (optional)
    """
    logger.info(f"Creating project '{project_in.name}' for user {current_user.email}")
    
    project = Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id,
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    # Invalidate user's cached projects
    await redis_service.invalidate_user_projects(str(current_user.id))
    
    logger.info(f"Project created successfully with ID: {project.id}")
    
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
) -> list[Project]:
    """
    List all projects belonging to the current user.
    Uses Redis caching for improved performance.
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    user_id = str(current_user.id)
    
    # Try to get from cache first (only for first page without pagination)
    if skip == 0 and limit == 100:
        cached = await redis_service.get_user_projects(user_id)
        if cached:
            logger.debug(f"Cache hit for user {user_id} projects")
            # Convert cached dicts back to Project-like objects
            return cached
    
    # Fetch from database
    result = await db.execute(
        select(Project)
        .where(Project.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    
    # Cache the results (only for first page)
    if skip == 0 and limit == 100 and projects:
        projects_data = [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "owner_id": str(p.owner_id),
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in projects
        ]
        await redis_service.set_user_projects(user_id, projects_data)
        logger.debug(f"Cached {len(projects)} projects for user {user_id}")
    
    return list(projects)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Project:
    """
    Get a specific project by ID.
    """
    from uuid import UUID
    
    try:
        uuid_id = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format",
        )
    
    result = await db.execute(
        select(Project).where(
            Project.id == uuid_id,
            Project.owner_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    return project


@router.get("/{project_id}/tickets", response_model=list[TicketOut])
async def get_project_tickets(
    project_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Ticket]:
    """Get all tickets for a project."""
    from uuid import UUID

    try:
        uuid_id = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format",
        )

    project_result = await db.execute(
        select(Project).where(
            Project.id == uuid_id,
            Project.owner_id == current_user.id,
        )
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    tickets_result = await db.execute(
        select(Ticket)
        .where(Ticket.project_id == uuid_id)
        .order_by(Ticket.created_at.desc())
    )
    tickets = tickets_result.scalars().all()

    return list(tickets)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Project:
    """
    Update a project.
    """
    from uuid import UUID
    
    try:
        uuid_id = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format",
        )
    
    result = await db.execute(
        select(Project).where(
            Project.id == uuid_id,
            Project.owner_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    # Update fields
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)

    # Invalidate user's cached projects
    await redis_service.invalidate_user_projects(str(current_user.id))
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Delete a project.
    """
    from uuid import UUID
    
    try:
        uuid_id = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format",
        )
    
    result = await db.execute(
        select(Project).where(
            Project.id == uuid_id,
            Project.owner_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    await db.delete(project)
    await db.commit()

    # Invalidate user's cached projects
    await redis_service.invalidate_user_projects(str(current_user.id))
