"""The structured description of the opportunity the user supplied."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.common import HttpUrlStr, utcnow

WorkMode = Literal["remote", "hybrid", "onsite"]
ExtractionMethod = Literal["jsonld", "html", "manual"]


class OpportunityProfile(BaseModel):
    """What the listing itself says. Unknown values are ``None``/empty, never guessed.

    ``field_sources`` records where each populated field came from (``jsonld``, ``meta``,
    ``text``, ``manual``) so the report can be transparent about extraction quality.
    """

    source_url: HttpUrlStr | None = None
    company_name: str | None = None
    role_title: str | None = None
    job_type: str | None = None
    location: str | None = None
    remote_or_onsite: WorkMode | None = None
    salary: str | None = None
    experience_required: str | None = None
    experience_min_years: float | None = None
    experience_max_years: float | None = None
    education_required: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    application_deadline: str | None = None
    date_posted: str | None = None
    application_url: HttpUrlStr | None = None
    description: str = ""

    extraction_method: ExtractionMethod = "html"
    field_sources: dict[str, str] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
    extracted_at: datetime = Field(default_factory=utcnow)

    @property
    def all_skills(self) -> list[str]:
        """Required then preferred skills, without duplicates."""
        return list(dict.fromkeys([*self.required_skills, *self.preferred_skills]))

    @property
    def is_investigable(self) -> bool:
        """A company name is the minimum needed to search for anything else."""
        return bool(self.company_name and self.company_name.strip())
