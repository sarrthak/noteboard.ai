from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.projects import router as projects_router
from app.api.endpoints.huddle import router as huddle_router
from app.api.endpoints.design import router as design_router
from app.api.endpoints import tickets
from app.core.config import settings
from app.core.logging import setup_logging
from app.services.redis import redis_service
from app.services.knowledge_graph import knowledge_graph_service

# Initialize logging before anything else
setup_logging(level="INFO", json_logs=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await redis_service.connect()
    try:
        await knowledge_graph_service.connect()
    except Exception as e:
        logger.warning(f"Neo4j connection failed (non-critical): {e}")
    yield
    # Shutdown
    await knowledge_graph_service.disconnect()
    await redis_service.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Modular Monolith Application API",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(huddle_router)
app.include_router(design_router)
app.include_router(tickets.router, prefix="/tickets", tags=["tickets"])


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {"status": "ok", "service": "api"}


@app.get("/health")
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "0.1.0",
    }


@app.post("/test-worker")
async def test_worker(word: str = "hello"):
    """Trigger a test Celery task."""
    from app.worker import test_celery
    
    task = test_celery.delay(word)
    return {"task_id": task.id, "status": "Task submitted"}
