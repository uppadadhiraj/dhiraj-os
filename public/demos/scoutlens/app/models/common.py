"""Shared model primitives."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import urlparse

from pydantic import AfterValidator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _check_http_url(value: str) -> str:
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("must be an absolute http(s) URL")
    return value


# Plain ``str`` at runtime (JSON friendly) but guaranteed to be an http(s) URL.
HttpUrlStr = Annotated[str, AfterValidator(_check_http_url)]
