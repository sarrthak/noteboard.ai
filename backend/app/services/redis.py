"""
Redis service for caching and session management.
"""

import json
from typing import Any, Optional

import redis.asyncio as redis
from loguru import logger

from app.core.config import settings


class RedisService:
    """Redis service for caching operations."""

    def __init__(self):
        self._client: Optional[redis.Redis] = None

    async def connect(self) -> None:
        """Connect to Redis."""
        try:
            self._client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await self._client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            # Cache is best-effort; keep API available if Redis is down.
            self._client = None
            logger.warning(f"Redis unavailable, caching disabled (non-critical): {e}")

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.close()
            logger.info("Disconnected from Redis")

    @property
    def client(self) -> redis.Redis:
        """Get Redis client."""
        if not self._client:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return self._client

    async def get(self, key: str) -> Optional[str]:
        """Get a value from Redis."""
        if not self._client:
            return None
        return await self._client.get(key)

    async def set(
        self, 
        key: str, 
        value: str, 
        expire: Optional[int] = None
    ) -> bool:
        """Set a value in Redis with optional expiration (in seconds)."""
        if not self._client:
            return False
        return await self._client.set(key, value, ex=expire)

    async def delete(self, key: str) -> int:
        """Delete a key from Redis."""
        if not self._client:
            return 0
        return await self._client.delete(key)

    async def get_json(self, key: str) -> Optional[Any]:
        """Get a JSON value from Redis."""
        data = await self.get(key)
        if data:
            return json.loads(data)
        return None

    async def set_json(
        self, 
        key: str, 
        value: Any, 
        expire: Optional[int] = None
    ) -> bool:
        """Set a JSON value in Redis."""
        return await self.set(key, json.dumps(value), expire)

    # Project caching methods
    async def get_user_projects(self, user_id: str) -> Optional[list[dict]]:
        """Get cached projects for a user."""
        return await self.get_json(f"user:{user_id}:projects")

    async def set_user_projects(
        self, 
        user_id: str, 
        projects: list[dict],
        expire: int = 300  # 5 minutes default
    ) -> bool:
        """Cache projects for a user."""
        return await self.set_json(f"user:{user_id}:projects", projects, expire)

    async def invalidate_user_projects(self, user_id: str) -> int:
        """Invalidate cached projects for a user."""
        return await self.delete(f"user:{user_id}:projects")


# Global Redis service instance
redis_service = RedisService()
