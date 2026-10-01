"""Session state and shared services for the UI."""
from __future__ import annotations

from dataclasses import dataclass

import streamlit as st

from config import Settings, get_settings
from models.report import InvestigationReport
from services.cache.repository import InvestigationRepository
from services.cache.search_cache import SearchCache

VIEWS = ("home", "investigation", "report", "history")


@dataclass(frozen=True)
class Services:
    settings: Settings
    repository: InvestigationRepository
    cache: SearchCache


@st.cache_resource
def get_services() -> Services:
    settings = get_settings()
    return Services(settings=settings, repository=InvestigationRepository(settings.db_path), cache=SearchCache(settings.db_path))


def init_state() -> None:
    st.session_state.setdefault("view", "home")


def go(view: str) -> None:
    """Switch view and rerun. Only known views are accepted."""
    if view not in VIEWS:
        raise ValueError(f"unknown view: {view}")
    st.session_state["view"] = view
    st.rerun()


def current_report() -> InvestigationReport | None:
    report = st.session_state.get("report")
    return report if isinstance(report, InvestigationReport) else None
