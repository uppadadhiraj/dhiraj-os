"""Secret redaction. Applied to every exception detail and log line that might contain a request URL."""
from __future__ import annotations

import re
from collections.abc import Iterable

_QUERY_SECRET = re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|token|key)=([^&\s'\")]+)")
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]+")


def redact_secrets(text: str, known_secrets: Iterable[str | None] = ()) -> str:
    """Mask API keys in ``text``.

    ``known_secrets`` are replaced verbatim (catches keys that appear outside a query string);
    the regexes catch ``api_key=...`` query parameters and ``Bearer`` tokens.
    """
    for secret in known_secrets:
        if secret and len(secret) >= 4:
            text = text.replace(secret, "***")
    text = _QUERY_SECRET.sub(r"\1=***", text)
    return _BEARER.sub("Bearer ***", text)
