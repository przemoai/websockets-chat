import json
from typing import Any, Dict, List, Optional

import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logger import logger


class RedisClient:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.pubsub = None

    async def connect(self) -> None:
        """Initialize Redis connection."""
        try:
            if settings.REDIS_PASSWORD:
                self.redis = aioredis.from_url(
                    f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}",
                    encoding="utf-8",
                    decode_responses=True,
                    health_check_interval=30,
                )
            else:
                self.redis = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    health_check_interval=30,
                )

            await self.redis.ping()
            logger.info(
                f"Connected to Redis at {settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )

        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()
            logger.info("Disconnected from Redis")

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        """Publish a message to a Redis channel."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            message_str = json.dumps(message)
            await self.redis.publish(channel, message_str)
            logger.debug(f"Published message to channel '{channel}': {message}")
        except Exception as e:
            logger.error(f"Failed to publish message to Redis: {e}")

    async def subscribe(self, *channels: str):
        """Subscribe to Redis channels."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            self.pubsub = self.redis.pubsub()
            await self.pubsub.subscribe(*channels)
            logger.info(f"Subscribed to channels: {channels}")
            return self.pubsub
        except Exception as e:
            logger.error(f"Failed to subscribe to Redis channels: {e}")
            raise

    async def set_with_expiry(self, key: str, value: Any, expiry: int = 3600) -> None:
        """Set a key-value pair with expiry time."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            value_str = json.dumps(value) if isinstance(value, dict) else str(value)
            await self.redis.setex(key, expiry, value_str)
        except Exception as e:
            logger.error(f"Failed to set key in Redis: {e}")

    async def get(self, key: str) -> Optional[Any]:
        """Get value by key."""
        if not self.redis:
            logger.error("Redis not connected")
            return None

        try:
            value = await self.redis.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
        except Exception as e:
            logger.error(f"Failed to get key from Redis: {e}")
            return None

    async def delete(self, key: str) -> None:
        """Delete a key from Redis."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Failed to delete key from Redis: {e}")

    async def add_to_set(self, key: str, value: str) -> None:
        """Add value to a Redis set."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            await self.redis.sadd(key, value)
        except Exception as e:
            logger.error(f"Failed to add to set in Redis: {e}")

    async def remove_from_set(self, key: str, value: str) -> None:
        """Remove value from a Redis set."""
        if not self.redis:
            logger.error("Redis not connected")
            return

        try:
            await self.redis.srem(key, value)
        except Exception as e:
            logger.error(f"Failed to remove from set in Redis: {e}")

    async def get_set_members(self, key: str) -> List[str]:
        """Get all members of a Redis set."""
        if not self.redis:
            logger.error("Redis not connected")
            return []

        try:
            members = await self.redis.smembers(key)
            return list(members) if members else []
        except Exception as e:
            logger.error(f"Failed to get set members from Redis: {e}")
            return []


redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency to get Redis client."""
    return redis_client
