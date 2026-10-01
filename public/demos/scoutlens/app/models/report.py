"""Structured outputs of the analysis stages and the final report.

Everything the UI renders comes from these models. Anything a user could read as a factual claim
carries ``evidence_ids`` that resolve to items in the evidence store.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, computed_field

from models.company import CompanyProfile
from models.evidence import EvidenceItem
from models.opportunity import OpportunityProfile
from models.preferences import UserPreferences
from models.resume import FitSummary, ResumeProfile
from models.search import SearchRecord

# -------------------------------------------------------------------------- market

class MarketSignal(BaseModel):
    """Demand for one skill within the sampled listings. ``total`` is the real sample size."""

    skill: str
    count: int = Field(ge=0)
    total: int = Field(ge=0)
    scope: Literal["in_listing", "adjacent"]  # named by this listing, or common in the sample but not named
    resume_status: Literal["matched", "partial", "not_found", "unknown"] | None = None  # ``None``: no resume supplied
    missing_from_resume: bool | None = None  # True for not_found/partial; ``None`` when unknown or no resume
    statement: str  # FACT
    interpretation: str  # neutral INTERPRETATION
    action: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def percent(self) -> float:
        return round(100 * self.count / self.total, 1) if self.total else 0.0


class MarketAnalysis(BaseModel):
    role_query: str
    location: str | None = None
    sample_size: int = 0
    low_sample: bool = False
    excluded_off_role: int = 0
    signals: list[MarketSignal] = Field(default_factory=list)
    method: str = ""
    search_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------- news

Relevance = Literal["high", "medium", "low"]


class NewsHighlight(BaseModel):
    """A retained news item. ``summary`` is verbatim source text (FACT); ``topic`` and
    ``relevance_reason`` are ScoutLens's neutral INTERPRETATION."""

    title: str
    url: str
    publisher: str | None = None
    date_text: str | None = None
    published_at: datetime | None = None
    summary: str
    topic: str
    relevance: Relevance
    relevance_reason: str
    evidence_id: str
    tier: Literal[1, 2, 3]


class NewsSignal(BaseModel):
    company: str
    items: list[NewsHighlight] = Field(default_factory=list)
    total_found: int = 0
    excluded_irrelevant: int = 0
    excluded_old: int = 0
    search_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


# ----------------------------------------------------------------- hiring signals

ComparisonKind = Literal["volume", "listing", "skills", "experience", "location", "work_mode", "salary"]


class SkillFrequency(BaseModel):
    """How many of the analysed listings mention a skill. ``total`` is the real sample size."""

    skill: str
    count: int = Field(ge=0)
    total: int = Field(ge=0)
    in_original: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def percent(self) -> float:
        return round(100 * self.count / self.total, 1) if self.total else 0.0


class ExperienceObservation(BaseModel):
    title: str
    location: str | None = None
    raw: str
    min_years: float | None = None
    max_years: float | None = None
    evidence_id: str | None = None


class LocationCount(BaseModel):
    location: str
    count: int


class SignalComparison(BaseModel):
    """One neutral observation comparing the original listing with the employer's other listings."""

    kind: ComparisonKind
    fact: str
    interpretation: str = ""
    action: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    strength: float = 0.0  # internal ranking hint, never shown as a score


class HiringSignal(BaseModel):
    company: str
    sample_size: int = Field(ge=0, description="Other current listings from this employer that were analysed")
    excluded_other_company: int = 0
    similar_count: int = 0
    original_found: bool = False
    original_via: str | None = None
    search_region: str | None = None  # where the sampled listings actually came from

    skill_frequencies: list[SkillFrequency] = Field(default_factory=list)
    experience: list[ExperienceObservation] = Field(default_factory=list)
    locations: list[LocationCount] = Field(default_factory=list)
    work_modes: dict[str, int] = Field(default_factory=dict)
    salary_listed_count: int = 0
    salary_examples: list[str] = Field(default_factory=list)
    titles: list[str] = Field(default_factory=list)

    comparisons: list[SignalComparison] = Field(default_factory=list)
    listing_evidence_ids: list[str] = Field(default_factory=list)
    search_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return self.sample_size > 0


# ------------------------------------------------------- findings and cross-checks

FindingKind = Literal[
    "volume", "listing", "skills", "experience", "location", "work_mode", "salary",
    "news", "funding", "market", "freshness", "deadline",
]


class Finding(BaseModel):
    """One item of "What you might have missed". FACT / INTERPRETATION / ACTION stay separate, and a
    finding without evidence cannot exist (NO SOURCE = NO FACT)."""

    kind: FindingKind
    icon: str
    title: str
    fact: str
    interpretation: str
    action: str | None = None
    evidence_ids: list[str] = Field(min_length=1)
    sources_summary: str
    strength: float = 0.0  # internal ordering only; never displayed as a score


class CrossCheck(BaseModel):
    """Whether an important claim is supported by more than one independent signal."""

    claim: str
    status: Literal["corroborated", "single_source", "conflicting", "insufficient"]
    detail: str
    evidence_ids: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------- the report

class InvestigationMethod(BaseModel):
    """Everything needed to show that the data is live and how it was gathered."""

    started_at: datetime
    finished_at: datetime | None = None
    displayed_time: str = ""  # e.g. "2026-09-30 16:32 IST"
    searches: list[SearchRecord] = Field(default_factory=list)
    apis_used: list[str] = Field(default_factory=list)
    company_listings_analyzed: int = 0  # other listings from the same employer
    market_listings_analyzed: int = 0  # role-level sample (may overlap with the above; reported separately)
    news_results_analyzed: int = 0
    sources_retained: int = 0
    refreshed: bool = False
    llm: str | None = None  # provider/model if one contributed, else None
    llm_used_for: list[str] = Field(default_factory=list)
    plan_notes: list[str] = Field(default_factory=list)

    @property
    def job_listings_analyzed(self) -> int:
        return self.company_listings_analyzed + self.market_listings_analyzed

    @property
    def searches_performed(self) -> int:
        return len(self.searches)

    @property
    def searches_live(self) -> int:
        return sum(1 for s in self.searches if not s.from_cache and not s.error)

    @property
    def searches_cached(self) -> int:
        return sum(1 for s in self.searches if s.from_cache)

    @property
    def searches_failed(self) -> int:
        return sum(1 for s in self.searches if s.error)


class Indicator(BaseModel):
    """An independent, measurable indicator. ScoutLens deliberately has no overall score."""

    label: str
    value: str
    detail: str = ""


class NextAction(BaseModel):
    text: str
    reason: str = ""
    evidence_ids: list[str] = Field(default_factory=list)


class InvestigationReport(BaseModel):
    id: str
    created_at: datetime
    status: Literal["complete", "partial"] = "complete"
    is_demo: bool = False

    opportunity: OpportunityProfile
    company: CompanyProfile | None = None
    hiring: HiringSignal | None = None
    news: NewsSignal | None = None
    market: MarketAnalysis | None = None
    resume: ResumeProfile | None = None
    preferences: UserPreferences | None = None
    fit: FitSummary | None = None

    findings: list[Finding] = Field(default_factory=list)
    crosschecks: list[CrossCheck] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    indicators: list[Indicator] = Field(default_factory=list)
    next_actions: list[NextAction] = Field(default_factory=list)
    method: InvestigationMethod
    warnings: list[str] = Field(default_factory=list)  # partial failures, unavailable components

    def evidence_by_id(self) -> dict[str, EvidenceItem]:
        return {e.id: e for e in self.evidence}
