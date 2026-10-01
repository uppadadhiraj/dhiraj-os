"""Build an :class:`OpportunityProfile` from a fetched page or pasted text.

Order of trust: JSON-LD ``JobPosting`` > page metadata > text heuristics > URL inference.
Anything that could not be found stays ``None``; ``field_sources`` records provenance and
``notes`` records caveats the UI should surface.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from models.opportunity import ExtractionMethod, OpportunityProfile
from services.scraping.html_text import extract_main_text, fragment_to_text
from services.scraping.jsonld import JobPostingData, find_job_postings, parse_job_posting
from services.scraping.text_parsers import (
    detect_job_type,
    detect_work_mode,
    parse_deadline,
    parse_education,
    parse_experience,
    parse_location,
    parse_salary,
    split_sections,
)
from services.skills import extract_skills, normalize_skill
from utils.domains import ATS_PATH_HOSTS, ATS_SUBDOMAIN_SUFFIXES, JOB_BOARDS, registered_domain
from utils.errors import ExtractionError

logger = logging.getLogger(__name__)

MIN_TEXT_CHARS = 200
MAX_DESCRIPTION_CHARS = 20_000
MAX_LIST_ITEMS = 20
MAX_ITEM_CHARS = 300
_PASTE_HINT = " You can paste the job description manually instead."

_BLOCKED = re.compile(
    r"access denied|verify you are (?:a )?human|captcha|are you a robot|just a moment\.\.\.|unusual traffic",
    re.I,
)
_LOGIN_WALL = re.compile(r"(?:sign|log) ?in to (?:view|see|continue)|join now to see", re.I)

# ---------------------------------------------------------------- company/role

_GENERIC_TITLE_PART = re.compile(
    r"^(?:careers?|jobs?|job (?:openings?|application|details?|listing|description)|apply(?: now)?|hiring|"
    r"join us|work with us|open positions?|linkedin|indeed(?:\.com)?|glassdoor|naukri(?:\.com)?|internshala|"
    r"greenhouse|lever|workday|ashby|wellfound|home|talent)$",
    re.I,
)
_ROLE_WORDS = re.compile(
    r"\b(engineer|developer|intern|internship|analyst|scientist|manager|designer|architect|consultant|"
    r"associate|specialist|administrator|lead|director|officer|executive|trainee|programmer|tester|qa|"
    r"sde|devops|researcher|coordinator|assistant|writer|marketer|recruiter|representative)\b",
    re.I,
)
_TITLE_SPLIT = re.compile(r"\s+[|–—·•]\s+|\s+-\s+|\s*\|\s*")
_AT_SPLIT = re.compile(r"^(?P<role>.+?)\s+(?:at|@)\s+(?P<company>[^|–—-]+)$", re.I)



def split_title(title: str) -> tuple[str | None, str | None]:
    """Split a page title like "Backend Engineer - Northwind Labs | Careers" into (role, company)."""
    parts = [p.strip() for p in _TITLE_SPLIT.split(" ".join(title.split())) if p.strip()]
    parts = [p for p in parts if not _GENERIC_TITLE_PART.match(p)]
    if not parts:
        return None, None
    if len(parts) == 1:
        at = _AT_SPLIT.match(parts[0])
        if at:
            return at.group("role").strip(), at.group("company").strip()
        return (parts[0], None) if _ROLE_WORDS.search(parts[0]) else (None, parts[0])
    role_index = next((i for i, p in enumerate(parts) if _ROLE_WORDS.search(p)), 0)
    role = parts[role_index]
    rest = [p for i, p in enumerate(parts) if i != role_index]
    company = rest[0]
    at = _AT_SPLIT.match(role)
    if at:  # "Role at Company - City"
        return at.group("role").strip(), at.group("company").strip()
    return role, company


def _slug_to_name(slug: str) -> str:
    return " ".join(w.capitalize() for w in re.split(r"[-_ ]+", slug) if w)


def infer_company_from_url(url: str) -> str | None:
    """Best-effort company name from an ATS/careers URL. Returns ``None`` for generic job boards."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if not host or any(host == b or host.endswith("." + b) for b in JOB_BOARDS):
        return None
    if host in ATS_PATH_HOSTS:
        segment = next((s for s in parsed.path.split("/") if s), "")
        return _slug_to_name(segment) or None
    if host.endswith(ATS_SUBDOMAIN_SUFFIXES):
        return _slug_to_name(host.split(".")[0]) or None
    return _slug_to_name(registered_domain(host).split(".")[0]) or None


# --------------------------------------------------------------------- helpers

def _meta(soup: BeautifulSoup, prop: str) -> str | None:
    tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
    content = tag.get("content") if tag else None
    if not content:
        return None
    return " ".join(str(content).split()) or None


def _trim_items(items: list[str]) -> list[str]:
    cleaned = [" ".join(i.split())[:MAX_ITEM_CHARS] for i in items if i and i.strip()]
    return cleaned[:MAX_LIST_ITEMS]


def _skills_from_labels(labels: list[str]) -> list[str]:
    found = []
    for label in labels:
        skill = normalize_skill(label)
        found += [skill] if skill else extract_skills(label)
    return list(dict.fromkeys(found))


def _pick_posting(postings: list[dict], url: str | None) -> dict:
    """Prefer the posting whose ``url`` matches the page; otherwise the first one."""
    if url and len(postings) > 1:
        for posting in postings:
            if isinstance(posting.get("url"), str) and posting["url"].rstrip("/") == url.rstrip("/"):
                return posting
    return postings[0]


def _check_readable(text: str, has_structured_data: bool) -> None:
    if has_structured_data:
        return  # a JobPosting node is enough to work with, even if its description is short
    if _BLOCKED.search(text) and len(text) < 2000:
        raise ExtractionError("The website blocked automated access." + _PASTE_HINT)
    if _LOGIN_WALL.search(text) and len(text) < 2000:
        raise ExtractionError("The listing appears to require signing in." + _PASTE_HINT)
    if len(text) < MIN_TEXT_CHARS:
        raise ExtractionError(
            "The page had too little readable text (it may load its content with JavaScript)." + _PASTE_HINT
        )


# ------------------------------------------------------------------- pipeline

def _assemble(
    *,
    description: str,
    method: ExtractionMethod,
    source_url: str | None,
    data: JobPostingData | None,
    role_title: str | None,
    company_name: str | None,
    location: str | None,
    sources: dict[str, str],
    notes: list[str],
) -> OpportunityProfile:
    """Shared back half: parse fields out of ``description`` and merge with structured ``data``."""
    description = description[:MAX_DESCRIPTION_CHARS]
    if not location and (location := parse_location(description)):
        sources["location"] = "text"
    sections = split_sections(description)
    has_sections = bool(sections["requirements"] or sections["responsibilities"])

    responsibilities = _trim_items((data.responsibilities if data else []) or sections["responsibilities"])
    qualifications = _trim_items((data.qualifications if data else []) or sections["requirements"])
    if responsibilities:
        sources["responsibilities"] = "jsonld" if data and data.responsibilities else "text"
    if qualifications:
        sources["qualifications"] = "jsonld" if data and data.qualifications else "text"

    # Skills: requirement + responsibility text (+ schema.org skills) => required; preferred section => preferred.
    required_text = "\n".join([*qualifications, *responsibilities])
    required = _skills_from_labels(data.skills) if data else []
    if has_sections or required:
        required = list(dict.fromkeys([*required, *extract_skills(required_text)]))
    else:
        required = extract_skills(f"{role_title or ''}\n{description}")
        if required:
            notes.append(
                "The listing has no clearly labelled requirements section, so every skill mentioned "
                "is listed as required; the requirement level could not be distinguished."
            )
    preferred = [s for s in extract_skills("\n".join(sections["preferred"])) if s not in required]
    if required:
        sources["required_skills"] = "jsonld" if data and data.skills else "text"
    if preferred:
        sources["preferred_skills"] = "text"

    # Experience
    exp_min = exp_max = None
    experience_raw: str | None = None
    if data and data.experience_months is not None:
        exp_min = data.experience_months / 12
        experience_raw = f"{data.experience_months:g} months"
        sources["experience_required"] = "jsonld"
    else:
        exp_text = data.experience_text if data and data.experience_text else None
        info = parse_experience(exp_text) if exp_text else None
        info = info or parse_experience("\n".join(qualifications)) or parse_experience(description)
        if info:
            exp_min, exp_max, experience_raw = info.min_years, info.max_years, info.raw
            sources["experience_required"] = "jsonld" if exp_text else "text"
        elif exp_text:
            experience_raw = exp_text
            sources["experience_required"] = "jsonld"

    lines = [*qualifications, *description.splitlines()]
    education = data.education_text if data and data.education_text else parse_education(lines)
    if education:
        sources["education_required"] = "jsonld" if data and data.education_text else "text"

    salary = (data.salary if data else None) or parse_salary(description)
    if salary:
        sources["salary"] = "jsonld" if data and data.salary else "text"

    deadline = (data.valid_through if data else None) or parse_deadline(description)
    if deadline:
        sources["application_deadline"] = "jsonld" if data and data.valid_through else "text"

    job_type = (data.employment_type if data else None) or detect_job_type(role_title, description)
    if job_type:
        sources["job_type"] = "jsonld" if data and data.employment_type else "text"

    if data and data.remote:
        work_mode, sources["remote_or_onsite"] = "remote", "jsonld"
    else:
        work_mode = detect_work_mode(role_title, location, description)
        if work_mode:
            sources["remote_or_onsite"] = "text"

    application_url = data.url if data and data.url and data.url.startswith(("http://", "https://")) else source_url

    if not role_title:
        notes.append(
            "The role title could not be identified; this page may list several jobs rather than one posting."
        )

    return OpportunityProfile(
        source_url=source_url,
        company_name=company_name,
        role_title=role_title,
        job_type=job_type,
        location=location,
        remote_or_onsite=work_mode,
        salary=salary,
        experience_required=experience_raw,
        experience_min_years=exp_min,
        experience_max_years=exp_max,
        education_required=education,
        required_skills=required,
        preferred_skills=preferred,
        responsibilities=responsibilities,
        qualifications=qualifications,
        application_deadline=deadline,
        date_posted=data.date_posted if data else None,
        application_url=application_url,
        description=description,
        extraction_method=method,
        field_sources=sources,
        notes=notes,
    )


def extract_from_html(content: bytes | str, url: str | None = None) -> OpportunityProfile:
    """Extract an opportunity from page HTML. Raises :class:`ExtractionError` if the page is unreadable."""
    soup = BeautifulSoup(content, "lxml")
    sources: dict[str, str] = {}
    notes: list[str] = []

    postings = find_job_postings(soup)
    data = parse_job_posting(_pick_posting(postings, url)) if postings else None

    page_title = _meta(soup, "og:title") or (soup.h1.get_text(" ", strip=True) if soup.h1 else None)
    title_tag = soup.title.get_text(" ", strip=True) if soup.title else None
    site_name = _meta(soup, "og:site_name")
    title_role, title_company = split_title(page_title or title_tag or "")
    if title_company is None and title_tag and title_tag != page_title:
        title_role_2, title_company = split_title(title_tag)
        title_role = title_role or title_role_2

    main_text = extract_main_text(soup)  # mutates soup (removes page chrome), so it runs last
    description = data.description if data and len(data.description) >= MIN_TEXT_CHARS else main_text
    _check_readable(description, has_structured_data=data is not None)

    # role
    role = data.title if data and data.title else None
    if role:
        sources["role_title"] = "jsonld"
    else:
        role = title_role or (page_title if page_title and _ROLE_WORDS.search(page_title) else None)
        if role:
            sources["role_title"] = "meta"
    # company
    company = data.company if data and data.company else None
    if company:
        sources["company_name"] = "jsonld"
    else:
        board_like = site_name and site_name.lower().split(".")[0] in {b.split(".")[0] for b in JOB_BOARDS}
        company = (site_name if site_name and not board_like else None) or title_company
        if company:
            sources["company_name"] = "meta"
        elif url and (inferred := infer_company_from_url(url)):
            company, sources["company_name"] = inferred, "url"
            notes.append("Company name was inferred from the URL. Please verify it before investigating.")
    # location
    location = data.location if data and data.location else None
    if location:
        sources["location"] = "jsonld"

    return _assemble(
        description=description,
        method="jsonld" if data else "html",
        source_url=url,
        data=data,
        role_title=role,
        company_name=company,
        location=location,
        sources=sources,
        notes=notes,
    )


def extract_from_text(
    text: str,
    *,
    source_url: str | None = None,
    company_name: str | None = None,
    role_title: str | None = None,
    location: str | None = None,
) -> OpportunityProfile:
    """Extract an opportunity from a manually pasted job description.

    ``company_name``/``role_title``/``location`` supplied by the user are authoritative
    (``field_sources`` = ``manual``). Nothing else is guessed except a role title taken from
    the first line, which is flagged in ``notes``.
    """
    structured = fragment_to_text(text or "")
    if len(structured) < 50:
        raise ExtractionError("The pasted description is too short to analyse. Paste the full listing text.")
    sources: dict[str, str] = {}
    notes: list[str] = []
    for name, value in (("company_name", company_name), ("role_title", role_title), ("location", location)):
        if value and value.strip():
            sources[name] = "manual"
    role = role_title.strip() if role_title and role_title.strip() else None
    if role is None:
        first = structured.splitlines()[0].removeprefix("## ").strip()
        if len(first) <= 100 and not first.endswith((".", ":")) and _ROLE_WORDS.search(first):
            role, sources["role_title"] = first, "text"
            notes.append("Role title was taken from the first line of the pasted text.")
    return _assemble(
        description=structured,
        method="manual",
        source_url=source_url,
        data=None,
        role_title=role,
        company_name=company_name.strip() if company_name and company_name.strip() else None,
        location=location.strip() if location and location.strip() else None,
        sources=sources,
        notes=notes,
    )
