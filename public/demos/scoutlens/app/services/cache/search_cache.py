"""Read-through cache for raw SerpApi responses, so repeat investigations cost no credits."""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from services.cache.db import connect

logger = logging.getLogger(__name__)


def make_cache_key(engine: str, params: dict[str, Any]) -> str:
    """Stable key from the engine and request params. ``api_key`` must never be part of it."""
    clean = {k: v for k, v in params.items() if k != "api_key"}
    payload = json.dumps({"engine": engine, **clean}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class SearchCache:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def get(self, key: str, ttl_hours: float) -> tuple[dict[str, Any], datetime] | None:
        """Return ``(response, fetched_at)`` if a fresh entry exists. ``ttl_hours <= 0`` disables caching."""
        if ttl_hours <= 0:
            return None
        try:
            with connect(self._db_path) as conn:
                row = conn.execute(
                    "SELECT response_json, fetched_at FROM search_cache WHERE cache_key = ?", (key,)
                ).fetchone()
        except sqlite3.Error:
            logger.warning("Search cache unavailable; continuing without it", exc_info=True)
            return None
        if row is None or time.time() - row["fetched_at"] > ttl_hours * 3600:
            return None
        try:
            data = json.loads(row["response_json"])
        except json.JSONDecodeError:
            return None
        return data, datetime.fromtimestamp(row["fetched_at"], tz=timezone.utc)

    def put(self, key: str, engine: str, query: str, data: dict[str, Any]) -> None:
        try:
            with connect(self._db_path) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO search_cache (cache_key, engine, query, response_json, fetched_at)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (key, engine, query, json.dumps(data), time.time()),
                )
        except sqlite3.Error:
            logger.warning("Could not write to search cache", exc_info=True)

    def clear(self) -> int:
        """Delete every cached response. Returns the number removed."""
        with connect(self._db_path) as conn:
            return conn.execute("DELETE FROM search_cache").rowcount
