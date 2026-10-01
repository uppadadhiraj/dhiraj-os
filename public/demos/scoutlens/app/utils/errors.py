"""Exception hierarchy.

Every error that can reach the UI derives from :class:`ScoutLensError` and carries a
``user_message`` that is safe to display (no keys, paths, prompts or stack traces).
"""
from __future__ import annotations


class ScoutLensError(Exception):
    """Base class. ``user_message`` is what the UI shows; ``str(exc)`` is for logs."""

    default_message = "Something went wrong. Please try again."

    def __init__(self, user_message: str | None = None, *, detail: str | None = None) -> None:
        self.user_message = user_message or self.default_message
        self.detail = detail
        super().__init__(detail or self.user_message)


class ConfigError(ScoutLensError):
    default_message = "ScoutLens is not fully configured. Check your .env file."


class InvalidURLError(ScoutLensError):
    default_message = "That doesn't look like a valid public http(s) URL."


class ExtractionError(ScoutLensError):
    default_message = (
        "The opportunity page could not be read. You can paste the job description manually instead."
    )


class SerpApiError(ScoutLensError):
    """Raised for any SerpApi failure. ``kind`` lets callers decide whether to continue, and also
    determines the default user-facing message, so wording lives in exactly one place."""

    default_message = "SerpApi could not be reached. Check SERPAPI_KEY and try again."
    KIND_MESSAGES = {
        "no_key": "SerpApi is not configured. Add SERPAPI_KEY to your .env file.",
        "invalid_key": "SerpApi rejected the API key. Check SERPAPI_KEY in your .env file.",
        "rate_limited": "SerpApi rate limit or search quota reached. Wait a moment or check your plan.",
        "timeout": "SerpApi took too long to respond. Try again in a moment.",
        "server_error": "SerpApi is temporarily unavailable.",
        "bad_response": "SerpApi returned an unreadable response.",
        "api_error": "SerpApi could not complete the search.",
    }

    def __init__(
        self,
        user_message: str | None = None,
        *,
        kind: str = "unknown",
        detail: str | None = None,
    ) -> None:
        super().__init__(user_message or self.KIND_MESSAGES.get(kind), detail=detail)
        self.kind = kind  # no_key | invalid_key | rate_limited | timeout | network | server_error | bad_response | api_error

    @property
    def is_fatal(self) -> bool:
        """Errors where retrying other searches is pointless."""
        return self.kind in {"invalid_key", "rate_limited", "no_key"}


class LLMUnavailableError(ScoutLensError):
    default_message = (
        "The language model is unavailable. ScoutLens will continue with deterministic analysis only."
    )


class LLMResponseError(ScoutLensError):
    default_message = "The language model returned an unusable response."


class ResumeParseError(ScoutLensError):
    default_message = "The resume could not be parsed. Make sure it is a text-based PDF under the size limit."
