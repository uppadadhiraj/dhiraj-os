"""Central logging configuration. Logs never include secrets: messages are redacted before emit."""
from __future__ import annotations

import logging

from utils.security import redact_secrets

_CONFIGURED = False


class _RedactingFilter(logging.Filter):
    """Redacts ``api_key=...`` style query parameters from log messages (e.g. request URLs)."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_secrets(record.getMessage())
        record.args = None
        return True


def setup_logging(level: str = "INFO") -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    handler.addFilter(_RedactingFilter())
    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # urllib3 logs full request URLs (which contain the SerpApi key) at DEBUG.
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    _CONFIGURED = True
