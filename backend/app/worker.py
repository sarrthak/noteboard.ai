from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "noteboard",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    worker_prefetch_multiplier=1,
)


@celery_app.task
def test_celery(word: str) -> str:
    """Test task for verifying Celery setup."""
    return f"test task return {word}"
