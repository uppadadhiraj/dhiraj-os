"""Low-level SerpApi client: one method, ``search``, with caching, retries and error mapping.

All failure modes are converted to :class:`SerpApiError` with a user-safe message. Exception
details are redacted because ``requests`` embeds the request URL (which contains the API key)
in its error strings.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import requests

from config import Settings
from models.common import utcnow
from models.search import SearchQuery, SearchRecord
from services.cache.search_cache import SearchCache, make_cache_key
from utils.errors import SerpApiError
from utils.security import redact_secrets

logger = logging.getLogger(__name__)

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"

# Where each engine puts its result list (used only to report result counts).
_RESULT_KEYS = {
    "google": "organic_results",
    "google_jobs": "jobs_results",
    "google_news": "news_results",
}
_MAX_ATTEMPTS = 2


@dataclass
class SerpResponse:
    record: SearchRecord
    data: dict[str, Any]

    @property
    def search_id(self) -> str:
        return self.record.id

    @property
    def fetched_at(self) -> datetime:
        return self.record.fetched_at


class SerpApiClient:
    """Executes :class:`SearchQuery` objects and keeps an audit log (``records``) of every search."""

    def __init__(
        self,
        settings: Settings,
        cache: SearchCache | None = None,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._settings = settings
        self._cache = cache
        self._session = session or requests.Session()
        self._sleep = sleep
        self.records: list[SearchRecord] = []

    # ------------------------------------------------------------------ public

    def search(self, query: SearchQuery, *, refresh: bool = False) -> SerpResponse:
        """Run ``query`` (cache first unless ``refresh``). Raises :class:`SerpApiError` on failure."""
        api_key = self._settings.serpapi_key_value()
        record = SearchRecord(
            id=f"s{len(self.records) + 1}",
            engine=query.engine,
            query=query.q,
            purpose=query.purpose,
        )
        try:
            params = self._build_params(query)
            cache_key = make_cache_key(query.engine, params)
            data = self._from_cache(cache_key, refresh, record)
            if data is None:
                if not api_key:
                    raise SerpApiError(kind="no_key")
                data = self._request(params, api_key)
                record.fetched_at = utcnow()
                if self._cache:
                    self._cache.put(cache_key, query.engine, query.q, data)
            record.result_count = len(data.get(_RESULT_KEYS[query.engine]) or [])
            record.serpapi_search_id = (data.get("search_metadata") or {}).get("id")
        except SerpApiError as exc:
            record.error = exc.user_message
            self.records.append(record)
            raise
        self.records.append(record)
        return SerpResponse(record=record, data=data)

    # ----------------------------------------------------------------- helpers

    def _from_cache(self, key: str, refresh: bool, record: SearchRecord) -> dict[str, Any] | None:
        if refresh or not self._cache:
            return None
        hit = self._cache.get(key, self._settings.cache_ttl_hours)
        if hit is None:
            return None
        data, fetched_at = hit
        record.from_cache = True
        record.fetched_at = fetched_at
        return data

    def _build_params(self, query: SearchQuery) -> dict[str, Any]:
        s = self._settings
        params: dict[str, Any] = {
            "engine": query.engine,
            "q": query.q,
            "gl": s.serpapi_gl,
            "hl": s.serpapi_hl,
        }
        # google_news does not accept `location`.
        location = query.location or s.serpapi_location
        if query.engine in ("google", "google_jobs") and location:
            params["location"] = location
        if query.engine == "google" and query.num:
            params["num"] = query.num
        params.update(query.params)
        return params

    def _request(self, params: dict[str, Any], api_key: str) -> dict[str, Any]:
        last_error: SerpApiError | None = None
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                return self._request_once(params, api_key)
            except SerpApiError as exc:
                last_error = exc
                retryable = exc.kind in {"timeout", "network", "server_error"}
                if not retryable or attempt == _MAX_ATTEMPTS:
                    raise
                logger.info("SerpApi %s (attempt %d); retrying", exc.kind, attempt)
                self._sleep(1.0 * attempt)
        raise last_error or SerpApiError()  # pragma: no cover - loop always returns or raises

    def _request_once(self, params: dict[str, Any], api_key: str) -> dict[str, Any]:
        try:
            resp = self._session.get(
                SERPAPI_ENDPOINT,
                params={**params, "api_key": api_key},
                timeout=self._settings.serpapi_timeout,
            )
        except requests.Timeout as exc:
            raise SerpApiError(kind="timeout", detail=redact_secrets(str(exc), [api_key])) from None
        except requests.RequestException as exc:
            raise SerpApiError(
                detail=redact_secrets(str(exc), [api_key]), kind="network"
            ) from None
        return self._interpret(resp, api_key)

    def _interpret(self, resp: requests.Response, api_key: str) -> dict[str, Any]:
        status = resp.status_code
        try:
            payload = resp.json()
        except ValueError:
            payload = None
        message = ""
        if isinstance(payload, dict):
            message = redact_secrets(str(payload.get("error", "")), [api_key])

        if status in (401, 403) or "invalid api key" in message.lower():
            raise SerpApiError(kind="invalid_key", detail=message)
        if status == 429 or any(t in message.lower() for t in ("run out of searches", "rate limit", "quota")):
            raise SerpApiError(kind="rate_limited", detail=message)
        if status >= 500:
            raise SerpApiError(kind="server_error", detail=f"HTTP {status}")
        if not isinstance(payload, dict):
            raise SerpApiError(kind="bad_response", detail=f"HTTP {status}")
        if message:
            # "Google hasn't returned any results for this query." is an empty result, not a failure.
            if "hasn't returned any results" in message.lower():
                return {k: v for k, v in payload.items() if k != "error"}
            raise SerpApiError(kind="api_error", detail=message)
        if status >= 400:
            raise SerpApiError(kind="api_error", detail=f"HTTP {status}")
        return payload
