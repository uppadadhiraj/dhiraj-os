"""What the investigation established about the employer. Every populated field carries evidence ids."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from models.common import HttpUrlStr

OverviewSource = Literal["knowledge_graph", "llm", "search_snippet"]


class CompanyFact(BaseModel):
    """A short statement plus the evidence that supports it. ``text`` is a verbatim excerpt or a
    template filled from retrieved data, never free-form model output."""

    text: str
    evidence_ids: list[str] = Field(min_length=1)


class CompanyProfile(BaseModel):
    name: str
    website: HttpUrlStr | None = None
    website_basis: str | None = None  # how the official site was determined
    website_evidence_ids: list[str] = Field(default_factory=list)

    overview: str | None = None  # may contain [E#] markers (rendered as links in the UI)
    overview_source: OverviewSource | None = None
    overview_evidence_ids: list[str] = Field(default_factory=list)

    industry: str | None = None
    attributes: dict[str, CompanyFact] = Field(default_factory=dict)  # e.g. headquarters, founded
    products: list[CompanyFact] = Field(default_factory=list)
    funding: list[CompanyFact] = Field(default_factory=list)

    identity_confirmed: bool = False
    ambiguous: bool = False
    gaps: list[str] = Field(default_factory=list)  # each is an explicit "Insufficient evidence: ..." note
