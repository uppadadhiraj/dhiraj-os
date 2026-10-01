"""Application configuration, loaded from environment variables / `.env`.

Secrets are wrapped in ``SecretStr`` so they never leak through ``repr`` or logs.
The UI must only ever use :meth:`Settings.public_status`, which exposes booleans.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """Typed settings. Field names map to upper-case env vars (``serpapi_key`` -> ``SERPAPI_KEY``)."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SerpApi
    serpapi_key: SecretStr | None = None
    serpapi_gl: str = "in"
    serpapi_hl: str = "en"
    serpapi_location: str = "India"
    serpapi_timeout: float = 45.0  # real Google searches (esp. with AI overviews) can take 20+ s

    # LLM
    llm_provider: Literal["ollama", "openai", "none"] = "ollama"
    llm_timeout: float = 180.0
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"

    # App
    # Hosted showcase mode: only the built-in demo can run; the URL/resume/paste inputs are hidden and
    # nothing is stored, so anonymous visitors never see each other's data. Off by default.
    public_demo: bool = False
    cache_ttl_hours: float = Field(default=24.0, ge=0)
    max_resume_mb: float = Field(default=5.0, gt=0)
    log_level: str = "INFO"
    db_path: Path = PROJECT_ROOT / "data" / "scoutlens.db"

    # Investigation budget (each search / result page costs one SerpApi credit when not cached)
    company_job_pages: int = Field(default=2, ge=1, le=5)
    market_pages: int = Field(default=3, ge=1, le=5)
    max_news_items: int = Field(default=8, ge=1)
    max_follow_up_searches: int = Field(default=3, ge=0, le=6)
    llm_planning: bool = False  # let the LLM propose up to 2 extra queries (validated, capped)
    display_timezone: str = "Asia/Kolkata"

    @property
    def has_serpapi_key(self) -> bool:
        return bool(self.serpapi_key and self.serpapi_key.get_secret_value().strip())

    def serpapi_key_value(self) -> str | None:
        """Return the raw key. Only the SerpApi client should call this."""
        return self.serpapi_key.get_secret_value().strip() if self.has_serpapi_key else None

    def public_status(self) -> dict[str, object]:
        """Non-sensitive configuration summary that is safe to render in the UI."""
        llm_model = {
            "ollama": self.ollama_model,
            "openai": self.openai_model,
            "none": None,
        }[self.llm_provider]
        return {
            "serpapi_configured": self.has_serpapi_key,
            "public_demo": self.public_demo,
            "llm_provider": self.llm_provider,
            "llm_model": llm_model,
            "cache_ttl_hours": self.cache_ttl_hours,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
