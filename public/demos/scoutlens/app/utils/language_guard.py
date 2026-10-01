"""Neutral-language guard for text ScoutLens itself writes (LLM output and templates).

Verbatim excerpts from retrieved sources are exempt: quoting a headline is not an accusation by
ScoutLens. Anything the *application* says must inform, never verdict.
"""
from __future__ import annotations

import re

_FORBIDDEN = re.compile(
    r"\b(?:scams?|scammers?|scammy|fraud(?:ulent|ster)?s?|fake|fakes|suspicious|unsafe|shady|bogus|sketchy|"
    r"phishing|ponzi|blacklisted|untrustworthy|trustworthy|legit(?:imate)?|"
    r"definitely (?:apply|good|bad|safe)|"
    r"you (?:should|must|need to|have to|ought to) (?:definitely )?(?:apply|learn|avoid|skip|take|join)|"
    r"do not apply|don'?t apply|avoid (?:this|the) (?:company|job|listing|opportunity)|"
    r"(?:great|terrible|bad|good|best|worst) (?:company|employer|opportunity)|guarantee[sd]?)\b",
    re.I,
)


def violations(text: str) -> list[str]:
    """Distinct forbidden phrases found in ``text`` (empty list means the text is acceptable)."""
    return sorted({m.group(0).lower() for m in _FORBIDDEN.finditer(text or "")})


def is_neutral(text: str) -> bool:
    return not violations(text)
