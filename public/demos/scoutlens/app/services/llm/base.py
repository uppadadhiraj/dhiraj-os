"""LLM provider abstraction.

Providers only implement ``_chat``. Structured generation (JSON -> validated Pydantic model, with
a bounded repair loop) lives here once, so every provider gets identical validation and the rest of
the app never parses raw model output.
"""
from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from utils.errors import LLMResponseError

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)


def extract_json(text: str) -> str:
    """Pull the JSON object out of a model reply that may include code fences or chatter."""
    text = _FENCE.sub("", text.strip())
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found in reply")
    return text[start : end + 1]


class LLMProvider(ABC):
    name = "llm"

    @abstractmethod
    def _chat(self, system: str, user: str, *, schema: dict | None, temperature: float) -> str:
        """Return the raw assistant text. Raise :class:`LLMUnavailableError` on connectivity/config problems."""

    @abstractmethod
    def check_available(self) -> tuple[bool, str]:
        """``(ok, human-readable status)``; must not raise."""

    def complete(self, system: str, user: str, *, temperature: float = 0.2) -> str:
        return self._chat(system, user, schema=None, temperature=temperature).strip()

    def generate_structured(
        self, model: type[T], system: str, user: str, *, max_repairs: int = 2, temperature: float = 0.1
    ) -> T:
        """Ask for JSON matching ``model`` and validate it, re-prompting with the error on failure.

        Raises :class:`LLMResponseError` if no valid object is produced within the repair budget.
        """
        schema = model.model_json_schema()
        instructions = (
            f"{system}\n\nRespond with ONLY a single JSON object that conforms to this JSON Schema. "
            f"No prose, no code fences.\n{json.dumps(schema)}"
        )
        prompt = user
        last_error = "unknown"
        for attempt in range(max_repairs + 1):
            reply = self._chat(instructions, prompt, schema=schema, temperature=temperature)
            try:
                return model.model_validate_json(extract_json(reply))
            except (ValueError, ValidationError) as exc:
                last_error = str(exc).splitlines()[0][:200]
                logger.info("LLM reply failed validation (attempt %d): %s", attempt + 1, last_error)
                prompt = (
                    f"{user}\n\nYour previous reply was not valid ({last_error}). "
                    "Reply again with ONLY the corrected JSON object."
                )
        raise LLMResponseError(detail=f"no valid structured reply after {max_repairs + 1} attempts: {last_error}")


class NullProvider(LLMProvider):
    """Used when ``LLM_PROVIDER=none`` or the configured provider lacks credentials."""

    name = "none"

    def __init__(self, reason: str = "LLM disabled (LLM_PROVIDER=none).") -> None:
        self._reason = reason

    def _chat(self, system: str, user: str, *, schema: dict | None, temperature: float) -> str:
        from utils.errors import LLMUnavailableError

        raise LLMUnavailableError(self._reason)

    def check_available(self) -> tuple[bool, str]:
        return False, self._reason
