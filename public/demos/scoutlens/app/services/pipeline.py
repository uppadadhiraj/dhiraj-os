"""From user inputs to a finished report: read the opportunity, parse the resume, investigate.

This is the single entry point the UI calls. It owns the "read" stage (the only stage that happens
before the Investigator runs), converts every failure into a :class:`ScoutLensError` with a safe
message, and raises :class:`NeedsCompanyError` (carrying what *was* extracted) when the employer's
name could not be determined, so the UI can ask for it instead of giving up.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from agents.investigator import STAGES, Investigator, ProgressEvent
from agents.opportunity_agent import read_opportunity_from_text, read_opportunity_from_url
from config import Settings
from models.common import utcnow
from models.opportunity import OpportunityProfile
from models.preferences import UserPreferences
from models.report import InvestigationReport
from models.resume import ResumeProfile
from services.cache.search_cache import SearchCache
from services.demo import demo_client, demo_opportunity, demo_resume
from services.llm.base import LLMProvider
from services.llm.factory import get_llm
from services.resume.parser import parse_resume_text
from services.resume.pdf import extract_text
from services.scraping.fetcher import PageFetcher
from services.serpapi.client import SerpApiClient
from utils.errors import InvalidURLError, ResumeParseError, ScoutLensError
from utils.urls import normalize_url

logger = logging.getLogger(__name__)
ProgressCallback = Callable[[ProgressEvent], None]
_READ_LABEL = dict(STAGES)["read"]


class NeedsCompanyError(ScoutLensError):
    """The listing was read but no employer name was found. ``opportunity`` holds what was extracted."""

    default_message = "The company name could not be found in the listing. Please enter it to continue."

    def __init__(self, opportunity: OpportunityProfile) -> None:
        super().__init__()
        self.opportunity = opportunity


@dataclass
class InvestigationRequest:
    url: str | None = None
    pasted_text: str | None = None
    company: str | None = None  # user-supplied; authoritative
    role: str | None = None
    location: str | None = None
    resume_bytes: bytes | None = None
    resume_profile: ResumeProfile | None = None  # already parsed (e.g. refreshing a saved report)
    prefs: UserPreferences = field(default_factory=UserPreferences)
    refresh: bool = False
    demo: bool = False
    opportunity: OpportunityProfile | None = None  # already read; skip fetching


def _clean(value: str | None) -> str | None:
    return value.strip() if value and value.strip() else None


def _emit(callback: ProgressCallback | None, status: str, detail: str = "") -> None:
    if callback:
        try:
            callback(ProgressEvent(stage="read", label=_READ_LABEL, status=status, detail=detail, index=1))  # type: ignore[arg-type]
        except Exception:  # noqa: BLE001 - a broken UI callback must not break the run
            logger.exception("Progress callback failed")


def _apply_manual_fields(opp: OpportunityProfile, request: InvestigationRequest) -> OpportunityProfile:
    """User-typed company/role/location are authoritative and recorded as such."""
    updates = {"company_name": _clean(request.company), "role_title": _clean(request.role), "location": _clean(request.location)}
    for name, value in updates.items():
        if value:
            setattr(opp, name, value)
            opp.field_sources[name] = "manual"
    if opp.notes and _clean(request.company):
        opp.notes = [n for n in opp.notes if "Company name was inferred" not in n]
    return opp


def _read_opportunity(request: InvestigationRequest, fetcher: PageFetcher | None) -> OpportunityProfile:
    if request.opportunity is not None:
        return _apply_manual_fields(request.opportunity, request)
    text, url = _clean(request.pasted_text), _clean(request.url)
    if text:
        source = normalize_url(url) if url else None
        opp = read_opportunity_from_text(
            text, company_name=_clean(request.company), role_title=_clean(request.role),
            location=_clean(request.location), source_url=source,
        )
        return opp
    if url:
        return _apply_manual_fields(read_opportunity_from_url(url, fetcher), request)
    raise InvalidURLError("Paste an opportunity URL, or paste the job description.")


def _parse_resume(request: InvestigationRequest, settings: Settings) -> tuple[ResumeProfile | None, str | None]:
    """``(profile, warning)``. A resume that cannot be read never blocks the investigation."""
    if request.resume_profile is not None:
        return request.resume_profile, None
    if not request.resume_bytes:
        return None, None
    try:
        return parse_resume_text(extract_text(request.resume_bytes, max_mb=settings.max_resume_mb)), None
    except ResumeParseError as exc:
        return None, f"The resume could not be used ({exc.user_message}) so personal-fit analysis was skipped."


def run_pipeline(
    request: InvestigationRequest,
    settings: Settings,
    *,
    on_progress: ProgressCallback | None = None,
    fetcher: PageFetcher | None = None,
    client: SerpApiClient | None = None,
    llm: LLMProvider | None = None,
    now: datetime | None = None,
) -> InvestigationReport:
    now = now or utcnow()
    _emit(on_progress, "running")
    resume_warning: str | None = None
    try:
        if request.demo:
            opp = demo_opportunity(now)
            resume = request.resume_profile or demo_resume()
            client = client or demo_client(now, settings)
            llm = None  # the demo must not depend on a local model
        else:
            opp = _read_opportunity(request, fetcher)
            resume, resume_warning = _parse_resume(request, settings)
            client = client or SerpApiClient(settings, cache=SearchCache(settings.db_path))
            llm = llm if llm is not None else get_llm(settings)
        if not opp.is_investigable:
            raise NeedsCompanyError(opp)
    except ScoutLensError as exc:
        _emit(on_progress, "failed", exc.user_message)
        raise
    resume_note = f"; resume parsed ({len(resume.skills)} skills)" if resume and not request.demo else ""
    _emit(on_progress, "done", f"{opp.role_title or 'Role'} at {opp.company_name}{resume_note}")

    report = Investigator(settings, client, llm).run(
        opp, resume=resume, prefs=request.prefs, refresh=request.refresh, on_progress=on_progress,
        is_demo=request.demo, now=now, announce_read=False,
    )
    if resume_warning:
        report.warnings.insert(0, resume_warning)
        report.status = "partial"
    return report
