"""Heuristic parsers that pull structured fields out of listing text.

Each returns ``None`` when nothing convincing is found: a missing field is always better than a
guessed one. Numeric results keep the verbatim matched text so the UI can show what the listing
actually said.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from models.opportunity import WorkMode

# ------------------------------------------------------------------ experience

_YR = r"(?:years?|yrs?)"
_N = r"(\d{1,2}(?:\.\d)?)"
_TAIL = r"(?:\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|hands-on\s+|industry\s+)?experience)?"
_EXP_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("range", re.compile(rf"{_N}\s*(?:-|–|—|to)\s*{_N}\s*\+?\s*{_YR}{_TAIL}", re.I)),
    ("min", re.compile(rf"(?:at least|minimum(?: of)?|min\.?|over|more than)\s*{_N}\s*\+?\s*{_YR}{_TAIL}", re.I)),
    ("plus", re.compile(rf"{_N}\s*\+\s*{_YR}{_TAIL}", re.I)),
    ("single", re.compile(rf"{_N}\s*{_YR}{_TAIL}", re.I)),
)
_FRESHER = re.compile(
    r"\b(freshers?(?:\s+(?:are\s+)?(?:eligible|welcome))?|fresh graduates?|entry[- ]level|"
    r"no (?:prior |previous )?(?:work )?experience(?: (?:is )?(?:required|needed|necessary))?|"
    r"new grads?|recent graduates?)\b",
    re.I,
)
_EXP_CONTEXT_WINDOW = 70
_NOT_REQUIREMENT = re.compile(r"\b(founded|established|since|market leader|our company|we have|of age)\b", re.I)


@dataclass(frozen=True)
class ExperienceInfo:
    raw: str
    min_years: float | None
    max_years: float | None


def parse_experience(text: str) -> ExperienceInfo | None:
    """Experience requirement, e.g. "0-2 years" -> (0, 2), "3+ years" -> (3, None), "Freshers" -> (0, None)."""
    candidates: list[tuple[int, int, ExperienceInfo]] = []
    for kind, pattern in _EXP_PATTERNS:
        for match in pattern.finditer(text):
            lo = max(0, match.start() - _EXP_CONTEXT_WINDOW)
            window = text[lo : match.end() + _EXP_CONTEXT_WINDOW]
            if "experience" not in window.lower() or _NOT_REQUIREMENT.search(window):
                continue
            first = float(match.group(1))
            last = float(match.group(2)) if kind == "range" else None
            info = ExperienceInfo(raw=match.group(0).strip(), min_years=first, max_years=last)
            candidates.append((match.start(), -len(match.group(0)), info))
    if candidates:
        # Earliest mention wins; among equal starts the longest (a range beats its own upper bound).
        return min(candidates, key=lambda c: (c[0], c[1]))[2]
    fresher = _FRESHER.search(text)
    if fresher:
        return ExperienceInfo(raw=fresher.group(0).strip(), min_years=0.0, max_years=None)
    return None


def format_experience(min_years: float | None, max_years: float | None) -> str:
    """Human-readable form of a numeric experience range, for comparisons in the report."""
    if min_years is None:
        return "not stated"

    def num(value: float) -> str:
        return str(int(value)) if float(value).is_integer() else str(value)

    if max_years is not None and max_years != min_years:
        return f"{num(min_years)}–{num(max_years)} years"
    if min_years == 0 and max_years is None:
        return "freshers / no experience stated"
    return f"{num(min_years)}+ years"


# ---------------------------------------------------------------------- salary

_CUR = r"(?:₹|Rs\.?|INR|US\$|\$|USD|€|EUR|£|GBP|CAD|AUD)"
_NUM = r"\d[\d,]*(?:\.\d+)?"
_UNIT = r"(?:\s?(?:k|K|lakhs?|lacs?|LPA|lpa|L|M|million|crores?|Cr)\b)?"
_PERIOD = r"(?:\s?(?:per|/|a|an)\s?(?:month|mo|year|yr|annum|hour|hr|week|day|p\.a\.|pa)\b)?"
_SALARY_RANGE_TAIL = rf"(?:\s?(?:-|–|—|to)\s?(?:{_CUR}\s?)?{_NUM}{_UNIT})?"
_SALARY = re.compile(rf"{_CUR}\s?{_NUM}{_UNIT}{_SALARY_RANGE_TAIL}{_PERIOD}")
_LPA = re.compile(rf"{_NUM}(?:\s?(?:-|–|to)\s?{_NUM})?\s?(?:LPA|lpa|lakhs? per annum)\b")
_PAY_CONTEXT = re.compile(
    r"salary|stipend|compensation|\bpay\b|\bctc\b|remuneration|per month|per annum|per year|per hour|"
    r"/month|/year|/hour|lpa|package|wage",
    re.I,
)
_NOT_PAY = re.compile(r"raised|funding|revenue|valuation|series [a-e]\b|arr\b|invested|grant", re.I)
_UNPAID = re.compile(r"\bunpaid\b", re.I)
_PAY_WINDOW = 80


def parse_salary(text: str) -> str | None:
    """Salary/stipend as written in the listing, or ``None``. Funding/revenue figures are ignored."""
    for pattern in (_SALARY, _LPA):
        for match in pattern.finditer(text):
            window = text[max(0, match.start() - _PAY_WINDOW) : match.end() + _PAY_WINDOW]
            near = text[max(0, match.start() - 40) : match.start()]
            if _PAY_CONTEXT.search(window) and not _NOT_PAY.search(near):
                return " ".join(match.group(0).split())
    unpaid = _UNPAID.search(text)
    return "Unpaid" if unpaid else None


# ------------------------------------------------------------------- education

_EDU_CASE_SENSITIVE = re.compile(
    r"\b(?:B\.?E\.?/B\.?Tech|B\.E\.?|B\.Tech|BTech|B\.Sc\.?|BSc|BCA|M\.Tech|MTech|M\.Sc\.?|MSc|MCA|MBA|Ph\.?D\.?|BBA|B\.Com)(?![A-Za-z])"
)
_EDU_INSENSITIVE = re.compile(
    r"\b(?:bachelor(?:'?s)?|master(?:'?s)?|degree|diploma|graduat(?:e|es|ion)|undergraduate|postgraduate|pursuing)\b",
    re.I,
)
_EDU_MAX_LEN = 220


def parse_education(lines: list[str]) -> str | None:
    """First line mentioning a degree/qualification, trimmed to a sensible length."""
    for line in lines:
        if _EDU_CASE_SENSITIVE.search(line) or _EDU_INSENSITIVE.search(line):
            line = " ".join(line.split())
            return line if len(line) <= _EDU_MAX_LEN else line[: _EDU_MAX_LEN - 1].rstrip() + "…"
    return None


# -------------------------------------------------------------------- deadline

_MONTH = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
_DATE = (
    rf"(?:\d{{1,2}}(?:st|nd|rd|th)?[\s\-/]+{_MONTH}\.?,?[\s\-/]*\d{{2,4}}"
    rf"|{_MONTH}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s*\d{{2,4}}"
    rf"|\d{{4}}-\d{{2}}-\d{{2}}"
    rf"|\d{{1,2}}/\d{{1,2}}/\d{{2,4}})"
)
_DEADLINE = re.compile(
    rf"(?:apply (?:by|before)|last date(?: to apply)?|application deadline|deadline|closing date|"
    rf"closes? on|applications? clos(?:e|es|ing)(?: on)?|valid through)\W{{0,12}}({_DATE})",
    re.I,
)


def parse_deadline(text: str) -> str | None:
    match = _DEADLINE.search(text)
    return " ".join(match.group(1).split()) if match else None


# -------------------------------------------------------------------- location

_LOCATION_LINE = re.compile(r"^\s*(?:job |work )?location\s*[:\-–]\s*(\S.{1,100})$", re.I | re.M)


def parse_location(text: str) -> str | None:
    """A labelled ``Location: ...`` line. Free-text mentions of cities are deliberately not guessed at."""
    match = _LOCATION_LINE.search(text)
    return " ".join(match.group(1).split()) if match else None


# ------------------------------------------------------------- job type / mode

_JOB_TYPE_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Internship", re.compile(r"\b(intern|internship|trainee|apprentice(?:ship)?)\b", re.I)),
    ("Contract", re.compile(r"\b(contract(?:or)?|contractual|freelance)\b", re.I)),
    ("Part-time", re.compile(r"\bpart[- ]time\b", re.I)),
    ("Full-time", re.compile(r"\bfull[- ]time\b", re.I)),
    ("Temporary", re.compile(r"\btemporary\b", re.I)),
)
_EMPLOYMENT_TYPE_MAP = {
    "FULL_TIME": "Full-time", "PART_TIME": "Part-time", "CONTRACTOR": "Contract",
    "TEMPORARY": "Temporary", "INTERN": "Internship", "VOLUNTEER": "Volunteer",
    "PER_DIEM": "Per diem", "OTHER": "Other",
}


def job_type_from_schema(value: str) -> str | None:
    """Map schema.org ``employmentType`` values (FULL_TIME, INTERN ...) to display text."""
    return _EMPLOYMENT_TYPE_MAP.get(value.strip().upper().replace(" ", "_").replace("-", "_"))


def detect_job_type(title: str | None, text: str) -> str | None:
    """Title is the strongest signal ("... Intern"); otherwise the first 1,500 chars of the description."""
    for source in (title or "", text[:1500]):
        for label, pattern in _JOB_TYPE_RULES:
            if pattern.search(source):
                return label
    return None


_REMOTE_WEAK = re.compile(r"\bremote\b|\bwork from home\b|\bwfh\b", re.I)
_REMOTE_STRONG = re.compile(
    r"\b(fully remote|100% remote|remote[- ]first|work from home|wfh|remote (?:position|role|job|opportunity|internship))\b",
    re.I,
)
_ONSITE = re.compile(r"\b(on[- ]?site|in[- ]office|work from office|office[- ]based|in[- ]person)\b", re.I)
_HYBRID = re.compile(r"\bhybrid\b", re.I)


def detect_work_mode(title: str | None, location: str | None, description: str) -> WorkMode | None:
    """Location/title are trusted for a bare "Remote"; the description only for explicit phrases."""
    header = f"{location or ''} {title or ''}"
    if _HYBRID.search(header):
        return "hybrid"
    if _REMOTE_WEAK.search(header):
        return "remote"
    head_of_description = description[:2500]
    if _HYBRID.search(head_of_description):
        return "hybrid"
    if _REMOTE_STRONG.search(head_of_description):
        return "remote"
    if _ONSITE.search(head_of_description):
        return "onsite"
    return None


# -------------------------------------------------------------------- sections

_PREFERRED = re.compile(r"preferred|nice[- ]to[- ]have|good to have|bonus|desirable|a plus|added advantage|optional", re.I)
_BENEFITS = re.compile(r"benefit|perks|what we offer|we offer|why join|compensation|why you.?ll love|life at|our culture", re.I)
_RESPONSIBILITIES = re.compile(
    r"responsibilit|what you.?ll (?:do|be doing|work on)|what you will (?:do|work on)|duties|key tasks|"
    r"day[- ]to[- ]day|role and responsibilit|job duties|you will",
    re.I,
)
_REQUIREMENTS = re.compile(
    r"requirement|qualification|what you.?ll need|what we.?re looking for|what you bring|who you are|"
    r"about you|must[- ]have|\bskills\b|you have|minimum|basic qual|eligibility|experience|education",
    re.I,
)
# Narrower requirement vocabulary for *unmarked* heading lines: "Experience with Docker" is a
# requirement item, not a heading, so the loose words (experience/skills/education) are excluded.
_REQUIREMENTS_STRICT = re.compile(
    r"requirement|qualification|what you.?ll need|what we.?re looking for|what you bring|who you are|"
    r"about you|must[- ]have|eligibility|^(?:technical |required |key )?skills(?: (?:&|and) experience)?$",
    re.I,
)
_INLINE_HEADING = re.compile(r"^([A-Za-z' /&\-]{3,45})\s*[:\-–]\s*(\S.*)$")
_BULLET = re.compile(r"^(?:[-•*▪●◦·]|\d+[.)])\s*")
_BARE_HEADING_MAX_WORDS = 7
_BARE_HEADING_MAX_CHARS = 60
SECTION_KINDS = ("responsibilities", "requirements", "preferred", "benefits", "about")


def classify_heading(heading: str, *, strict: bool = False) -> str | None:
    """Section kind for a heading, or ``None`` if it is not a recognised heading.

    ``strict`` is for lines that carry no heading markup (no ``##``, no trailing colon).
    """
    requirements = _REQUIREMENTS_STRICT if strict else _REQUIREMENTS
    for kind, pattern in (
        ("preferred", _PREFERRED),
        ("benefits", _BENEFITS),
        ("responsibilities", _RESPONSIBILITIES),
        ("requirements", requirements),
    ):
        if pattern.search(heading):
            return kind
    return None


def _bare_heading_kind(line: str) -> str | None:
    """Kind for a short, unmarked, sentence-free line such as ``Responsibilities`` or ``Nice to have``."""
    if len(line) > _BARE_HEADING_MAX_CHARS or len(line.split()) > _BARE_HEADING_MAX_WORDS:
        return None
    if _BULLET.match(line) or any(ch in line for ch in ".;,!?:"):
        return None  # a colon means "Heading: content", handled by the inline-heading path
    return classify_heading(line, strict=True)


def split_sections(text: str) -> dict[str, list[str]]:
    """Group structured text (see ``html_text``) into responsibilities/requirements/preferred/... items."""
    sections: dict[str, list[str]] = {kind: [] for kind in SECTION_KINDS}
    current = "about"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        heading: str | None = None
        if line.startswith("## "):
            heading = line[3:].strip()
        elif len(line) <= 60 and line.endswith(":"):
            heading = line[:-1].strip()
        if heading is not None:
            current = classify_heading(heading) or "about"
            continue
        bare = _bare_heading_kind(line)
        if bare:
            current = bare
            continue
        inline = _INLINE_HEADING.match(line)
        if inline and not _BULLET.match(line):
            kind = classify_heading(inline.group(1))
            if kind:
                current = kind
                sections[current].append(inline.group(2).strip())
                continue
        sections[current].append(_BULLET.sub("", line))
    return sections
