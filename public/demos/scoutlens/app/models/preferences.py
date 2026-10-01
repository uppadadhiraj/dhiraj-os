"""Optional user-stated preferences that steer the investigation."""
from __future__ import annotations

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    location: str | None = Field(default=None, max_length=120)
    target_role: str | None = Field(default=None, max_length=120)
    salary: str | None = Field(default=None, max_length=60)
    experience: str | None = Field(default=None, max_length=60)
    skills: list[str] = Field(default_factory=list)  # canonical skill names the user says they have

    @property
    def is_empty(self) -> bool:
        return not (self.location or self.target_role or self.salary or self.experience or self.skills)
