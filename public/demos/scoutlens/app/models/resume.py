"""The user's resume as structured data, and the result of comparing it with an opportunity."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SkillLevel = Literal["listed", "used", "mentioned", "self_reported"]
_LEVEL_RANK = {"listed": 3, "self_reported": 3, "used": 2, "mentioned": 1}
_LANGUAGE_CATEGORIES = {"language"}
_FRAMEWORK_CATEGORIES = {"framework"}
_TOOL_CATEGORIES = {"tool", "devops", "cloud", "database", "data_ml", "practice"}


class SkillEvidence(BaseModel):
    section: str  # e.g. "Skills", "Projects", "Experience", "Preferences"
    snippet: str


class ResumeSkill(BaseModel):
    name: str
    category: str | None = None
    level: SkillLevel
    evidence: list[SkillEvidence] = Field(default_factory=list)

    @property
    def rank(self) -> int:
        return _LEVEL_RANK[self.level]


class ResumeEntry(BaseModel):
    title: str
    details: list[str] = Field(default_factory=list)


class ResumeProfile(BaseModel):
    source: Literal["pdf", "entered"] = "pdf"  # "entered" = only the skills typed into the preferences form
    name: str | None = None
    education: list[str] = Field(default_factory=list)
    skills: list[ResumeSkill] = Field(default_factory=list)
    projects: list[ResumeEntry] = Field(default_factory=list)
    experience: list[ResumeEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    sections_found: list[str] = Field(default_factory=list)
    char_count: int = 0
    quality: Literal["good", "limited"] = "good"
    notes: list[str] = Field(default_factory=list)

    @property
    def skill_names(self) -> set[str]:
        return {s.name for s in self.skills}

    def skill(self, name: str) -> ResumeSkill | None:
        return next((s for s in self.skills if s.name == name), None)

    @property
    def programming_languages(self) -> list[str]:
        return [s.name for s in self.skills if s.category in _LANGUAGE_CATEGORIES]

    @property
    def frameworks(self) -> list[str]:
        return [s.name for s in self.skills if s.category in _FRAMEWORK_CATEGORIES]

    @property
    def tools(self) -> list[str]:
        return [s.name for s in self.skills if s.category in _TOOL_CATEGORIES]


# --------------------------------------------------------------------- fit results

MatchStatus = Literal["matched", "partial", "not_found", "unknown"]


class SkillMatch(BaseModel):
    """One required/preferred skill compared with the resume. ``not_found`` means *not found in the
    resume*, never "the user does not know it"."""

    skill: str
    requirement: Literal["required", "preferred"]
    status: MatchStatus
    basis: str  # plain-language reason, e.g. "Listed in the Skills section"
    resume_evidence: list[SkillEvidence] = Field(default_factory=list)
    related_skill: str | None = None  # the resume skill that implies / relates to it, if any


class FitSummary(BaseModel):
    """Independent, transparent measures. Deliberately no overall score."""

    matches: list[SkillMatch] = Field(default_factory=list)
    resume_quality: Literal["good", "limited"] = "good"
    total_requirements: int = 0
    matched: int = 0
    partial: int = 0
    not_found: int = 0
    unknown: int = 0
    required_total: int = 0
    required_matched: int = 0
    notes: list[str] = Field(default_factory=list)
    context: list[str] = Field(default_factory=list)  # side-by-side facts for non-skill dimensions

    @property
    def coverage_percent(self) -> float | None:
        """Matched / total (required + preferred). ``None`` when there is nothing to compare."""
        return round(100 * self.matched / self.total_requirements, 1) if self.total_requirements else None

    @property
    def required_coverage_percent(self) -> float | None:
        return round(100 * self.required_matched / self.required_total, 1) if self.required_total else None
