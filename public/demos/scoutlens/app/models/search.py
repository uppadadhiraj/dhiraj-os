"""Models for planned searches and the normalized results SerpApi returns.

Every result model carries ``search_id`` so any fact shown in the UI can be traced back to the
exact search that retrieved it (NO SOURCE = NO FACT).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.common import HttpUrlStr, utcnow

Engine = Literal["google", "google_jobs", "google_news"]


class SearchQuery(BaseModel):
    """A planned search. Produced by the planner, executed by the SerpApi client."""

    engine: Engine
    q: str = Field(min_length=1, max_length=300)
    purpose: str = ""
    location: str | None = None
    num: int | None = Field(default=None, ge=1, le=100)
    pages: int = Field(default=1, ge=1, le=5)
    params: dict[str, str] = Field(default_factory=dict)  # extra engine params, e.g. next_page_token


class SearchRecord(BaseModel):
    """A search that was actually executed (live or served from cache)."""

    id: str
    engine: Engine
    query: str
    purpose: str = ""
    from_cache: bool = False
    fetched_at: datetime = Field(default_factory=utcnow)
    result_count: int = 0
    error: str | None = None
    serpapi_search_id: str | None = None


class SearchHit(BaseModel):
    """One organic Google result."""

    search_id: str
    position: int | None = None
    title: str
    url: HttpUrlStr
    snippet: str = ""
    displayed_link: str | None = None
    date: str | None = None


class KnowledgeGraph(BaseModel):
    """Google's knowledge panel for an entity. Used for company identity."""

    search_id: str
    title: str
    type: str | None = None
    description: str | None = None
    website: HttpUrlStr | None = None
    source_name: str | None = None
    source_url: HttpUrlStr | None = None
    attributes: dict[str, str] = Field(default_factory=dict)


class ApplyLink(BaseModel):
    title: str
    url: HttpUrlStr


class JobListing(BaseModel):
    """One Google Jobs result."""

    search_id: str
    job_id: str | None = None
    title: str
    company_name: str | None = None
    location: str | None = None
    via: str | None = None
    description: str = ""
    posted_at: str | None = None
    schedule_type: str | None = None
    salary: str | None = None
    work_from_home: bool | None = None
    qualifications: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    apply_links: list[ApplyLink] = Field(default_factory=list)
    share_link: HttpUrlStr | None = None

    @property
    def url(self) -> str | None:
        """Best citable link: a direct apply link if present, else Google's share link."""
        if self.apply_links:
            return self.apply_links[0].url
        return self.share_link

    @property
    def text(self) -> str:
        """All descriptive text, used for skill extraction."""
        return "\n".join(
            [self.title, self.description, *self.qualifications, *self.responsibilities]
        )


class NewsItem(BaseModel):
    """One Google News result."""

    search_id: str
    title: str
    url: HttpUrlStr
    publisher: str | None = None
    date_text: str | None = None
    published_at: datetime | None = None
    snippet: str = ""
