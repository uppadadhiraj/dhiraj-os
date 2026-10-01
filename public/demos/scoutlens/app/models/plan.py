"""The investigation plan: which searches to run and why."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from models.search import SearchQuery


class PlannedSearch(BaseModel):
    """``key`` names the job a search does; agents pick their steps by key."""

    key: str
    query: SearchQuery
    reason: str

    @property
    def signature(self) -> tuple[str, str]:
        return (self.query.engine, self.query.q.strip().lower())


class InvestigationPlan(BaseModel):
    searches: list[PlannedSearch] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)  # decisions worth showing (e.g. skipped searches)

    def step(self, key: str) -> PlannedSearch | None:
        return next((s for s in self.searches if s.key == key), None)


@dataclass
class PlanState:
    """What the first round of searches found; input to the adaptive follow-up rules."""

    has_knowledge_graph: bool = False
    kg_founded_year: int | None = None
    official_domain_found: bool = False
    company_job_count: int = 0
    news_count: int = 0
    funding_searched: bool = False
