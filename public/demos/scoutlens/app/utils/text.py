"""Text normalisation helpers shared by the analysis agents."""
from __future__ import annotations

import re

_LEGAL_SUFFIXES = {
    "inc", "llc", "ltd", "limited", "pvt", "private", "corp", "corporation", "co", "company", "gmbh",
    "plc", "llp", "lp", "sa", "ag", "bv", "pte", "opc", "india",
}


# A trailing word like "Labs" or "Technologies" is often dropped in everyday usage ("Razorpay Software" -> "Razorpay").
GENERIC_TRAILING_WORDS = {
    "labs", "lab", "technologies", "technology", "tech", "software", "systems", "solutions", "group",
    "digital", "analytics", "networks", "innovations", "ai", "io",
}
_MIN_ALIAS_CHARS = 5


def normalize_company(name: str) -> str:
    """Lower-case, punctuation-free company name without legal suffixes ("Acme Pvt. Ltd." -> "acme")."""
    words = re.sub(r"[^a-z0-9& ]", " ", name.lower().replace("&", " and ")).split()
    while len(words) > 1 and words[-1] in _LEGAL_SUFFIXES:
        words.pop()
    return " ".join(words)


def company_matches(a: str | None, b: str | None) -> bool:
    """Whether two company-name strings plausibly refer to the same employer.

    Equal after normalisation, or one is a whole-word prefix of the other and at least 4 characters
    ("Acme" ~ "Acme Robotics"). Deliberately conservative: a false match would mix another
    company's listings into the analysis.
    """
    if not a or not b:
        return False
    na, nb = normalize_company(a), normalize_company(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    short, long_ = sorted((na, nb), key=len)
    return len(short) >= 4 and long_.startswith(short + " ")


def brand_alias(company: str) -> str | None:
    """The everyday short form of a company name, or ``None`` if there is no safe one.

    Only one trailing generic word is dropped and the result must be at least 5 characters, so
    "Northwind Labs" -> "northwind" but "Go Labs" -> ``None`` (too short to be distinctive).
    """
    words = normalize_company(company).split()
    if len(words) > 1 and words[-1] in GENERIC_TRAILING_WORDS:
        alias = " ".join(words[:-1])
        return alias if len(alias) >= _MIN_ALIAS_CHARS else None
    return None


def mentions_company(text: str | None, company: str) -> bool:
    """Whether ``text`` contains the company's name (or its safe brand alias) as a whole phrase."""
    if not text:
        return False
    needles = [n for n in (normalize_company(company), brand_alias(company)) if n]
    if not needles:
        return False
    haystack = " ".join(re.sub(r"[^a-z0-9& ]", " ", text.lower().replace("&", " and ")).split())
    return any(re.search(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", haystack) for n in needles)


def truncate(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
