"""
db/cache.py — Thin async Redis wrapper.

Used by detail endpoints for 60-second profile caching.
All errors are caught and logged so a Redis outage never breaks an API response.
"""

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from core.config import settings

logger = logging.getLogger(__name__)

# Module-level connection pool — shared across all requests.
# redis.asyncio.Redis is thread-safe and coroutine-safe.
_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _client


async def cache_get(key: str) -> Any | None:
    """Return parsed JSON value for *key*, or None on miss / error."""
    try:
        raw = await get_redis().get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.warning("Redis GET failed [%s]: %s", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """JSON-serialise *value* and write to Redis with *ttl* seconds. Silent on error."""
    try:
        await get_redis().setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("Redis SET failed [%s]: %s", key, exc)


async def cache_delete(key: str) -> None:
    """Delete a key. Silent on error."""
    try:
        await get_redis().delete(key)
    except Exception as exc:
        logger.warning("Redis DEL failed [%s]: %s", key, exc)
