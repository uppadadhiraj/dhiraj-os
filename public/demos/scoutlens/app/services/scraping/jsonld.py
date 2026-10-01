"""schema.org ``JobPosting`` extraction from JSON-LD, the most reliable source when a page has it."""
from __future__ import annotations

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from bs4 import BeautifulSoup

from services.scraping.html_text import fragment_to_text
from services.scraping.text_parsers import job_type_from_schema


@dataclass
class JobPostingData:
    """Raw values from a JobPosting node. Every field is optional; empty means "not provided"."""

    title: str | None = None
    company: str | None = None
    location: str | None = None
    remote: bool = False
    employment_type: str | None = None
    salary: str | None = None
    experience_text: str | None = None
    experience_months: float | None = None
    education_text: str | None = None
    skills: list[str] = field(default_factory=list)
    qualifications: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    valid_through: str | None = None
    date_posted: str | None = None
    url: str | None = None
    description: str = ""


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        cleaned = " ".join(value.split())
        return cleaned or None
    if isinstance(value, dict):
        return _text(value.get("name") or value.get("@value"))
    return None


def _walk(node: Any) -> Iterator[dict[str, Any]]:
    if isinstance(node, list):
        for item in node:
            yield from _walk(item)
    elif isinstance(node, dict):
        types = [str(t) for t in _as_list(node.get("@type"))]
        if "JobPosting" in types:
            yield node
        for key in ("@graph", "mainEntity", "itemListElement", "item"):
            if key in node:
                yield from _walk(node[key])


def find_job_postings(soup: BeautifulSoup) -> list[dict[str, Any]]:
    postings: list[dict[str, Any]] = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text()
        if not raw or not raw.strip():
            continue
        try:
            data = json.loads(raw, strict=False)
        except json.JSONDecodeError:
            try:  # tolerate trailing commas, a frequent CMS bug
                data = json.loads(re.sub(r",\s*([}\]])", r"\1", raw), strict=False)
            except json.JSONDecodeError:
                continue
        postings.extend(_walk(data))
    return postings


def _format_location(job_location: Any) -> str | None:
    places: list[str] = []
    for loc in _as_list(job_location):
        address = loc.get("address") if isinstance(loc, dict) else loc
        if isinstance(address, str):
            place = _text(address)
        elif isinstance(address, dict):
            parts = [
                _text(address.get("addressLocality")),
                _text(address.get("addressRegion")),
                _text(address.get("addressCountry")),
            ]
            place = ", ".join(dict.fromkeys(p for p in parts if p))
        else:
            place = _text(loc)
        if place and place not in places:
            places.append(place)
    return "; ".join(places[:3]) or None


def _format_amount(value: Any) -> str | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"{value:,.0f}" if float(value).is_integer() else f"{value:,}"
    return _text(value)


def _format_salary(base_salary: Any) -> str | None:
    if not isinstance(base_salary, dict):
        return _text(base_salary)
    currency = _text(base_salary.get("currency")) or ""
    value = base_salary.get("value")
    if not isinstance(value, dict):
        amount = _format_amount(value)
        return f"{currency} {amount}".strip() if amount else None
    low, high = _format_amount(value.get("minValue")), _format_amount(value.get("maxValue"))
    single = _format_amount(value.get("value"))
    amount = f"{low}–{high}" if low and high else (low or high or single)
    if not amount:
        return None
    unit = _text(value.get("unitText"))
    period = f" per {unit.lower()}" if unit else ""
    return f"{currency} {amount}{period}".strip()


def _string_items(value: Any) -> list[str]:
    """Flatten a str/list/dict-of-text field into cleaned lines (HTML allowed)."""
    items: list[str] = []
    for entry in _as_list(value):
        if isinstance(entry, dict):
            entry = entry.get("name") or entry.get("description")
        if isinstance(entry, str):
            text = fragment_to_text(entry)
            items += [re.sub(r"^[-•*]\s*", "", line).strip() for line in text.splitlines() if line.strip()]
    return items


def parse_job_posting(node: dict[str, Any]) -> JobPostingData:
    experience = node.get("experienceRequirements")
    months: float | None = None
    experience_text: str | None = None
    for entry in _as_list(experience):
        if isinstance(entry, dict) and isinstance(entry.get("monthsOfExperience"), (int, float)):
            months = float(entry["monthsOfExperience"])
        else:
            experience_text = experience_text or _text(entry)

    education = [_text(e.get("credentialCategory")) if isinstance(e, dict) else _text(e)
                 for e in _as_list(node.get("educationRequirements"))]

    skills: list[str] = []
    for entry in _as_list(node.get("skills")):
        text = _text(entry)
        if text:
            skills += [s.strip() for s in re.split(r"[,;\n]", text) if s.strip()]

    employment = _as_list(node.get("employmentType"))
    valid_through = _text(node.get("validThrough"))
    return JobPostingData(
        title=_text(node.get("title")),
        company=_text(node.get("hiringOrganization")),
        location=_format_location(node.get("jobLocation")),
        remote=str(node.get("jobLocationType", "")).upper() == "TELECOMMUTE",
        employment_type=job_type_from_schema(str(employment[0])) if employment else None,
        salary=_format_salary(node.get("baseSalary")),
        experience_text=experience_text,
        experience_months=months,
        education_text=next((e for e in education if e), None),
        skills=skills,
        qualifications=_string_items(node.get("qualifications")),
        responsibilities=_string_items(node.get("responsibilities")),
        valid_through=valid_through[:10] if valid_through and re.match(r"\d{4}-\d{2}-\d{2}", valid_through) else valid_through,
        date_posted=(_text(node.get("datePosted")) or "")[:10] or None,
        url=_text(node.get("url")),
        description=fragment_to_text(node["description"]) if isinstance(node.get("description"), str) else "",
    )
