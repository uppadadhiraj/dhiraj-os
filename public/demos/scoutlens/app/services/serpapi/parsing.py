"""Small helpers for defensively parsing SerpApi JSON (fields are frequently missing or oddly typed)."""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from typing import Any, TypeVar

from pydantic import ValidationError

logger = logging.getLogger(__name__)
T = TypeVar("T")


def clean_text(value: Any) -> str | None:
    """Return a stripped string, or ``None`` for missing/empty/non-scalar values."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        value = str(value)
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    return value or None


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def build_all(raw_items: Iterable[Any], builder: Callable[[dict[str, Any]], T]) -> list[T]:
    """Apply ``builder`` to each dict item, dropping (and logging) items that fail validation.

    A result without a usable title/URL cannot be cited, so it is dropped rather than repaired.
    """
    built: list[T] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            built.append(builder(item))
        except (ValidationError, ValueError, KeyError, TypeError) as exc:
            logger.debug("Dropped malformed SerpApi item: %s", exc)
    return built
