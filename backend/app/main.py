from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.projects import router as projects_router
from app.core.config import settings
from app.core.logging import setup_logging

# Initialize logging before anything else
setup_logging(level="INFO", json_logs=False)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Modular Monolith Application API",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
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
