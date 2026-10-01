"""History: reopen or delete previous investigations."""
from __future__ import annotations

import sqlite3

import streamlit as st

from agents.report_agent import format_display_time
from services.cache.repository import HistoryError
from ui.state import get_services
from ui.styles import badge, esc

_STATUS_KIND = {"complete": "ok", "partial": "warn"}


def _open(investigation_id: str) -> None:
    report = get_services().repository.get(investigation_id)
    if report is None:
        st.session_state["history_error"] = "That investigation could not be opened (it may have been saved by an older version)."
        return
    st.session_state["report"] = report
    st.session_state["view"] = "report"


def render() -> None:
    services = get_services()
    st.markdown('<div class="sl-eyebrow">History</div><h2>Previous investigations</h2>', unsafe_allow_html=True)
    if message := st.session_state.pop("history_error", None):
        st.error(message)

    if services.settings.public_demo:
        st.markdown(
            '<div class="sl-notice">History is turned off in the public demo: nothing is stored, so there is nothing to show. '
            "Run ScoutLens locally to keep a history of your own investigations.</div>",
            unsafe_allow_html=True,
        )
        return

    items = services.repository.list()
    if not items:
        st.markdown('<div class="sl-notice">No investigations yet. Run one from the home page, or try the demo.</div>', unsafe_allow_html=True)
        return

    for item in items:
        with st.container(border=True):
            info, when, open_col, delete_col = st.columns([5, 2.2, 1.1, 1.1], vertical_alignment="center")
            title = f"{esc(item.role or 'Role not identified')} · {esc(item.company or 'Company not identified')}"
            chips = badge(item.status, _STATUS_KIND.get(item.status, "muted")) + (badge("Demo data", "warn") if item.is_demo else "")
            info.markdown(f"**{title}** {chips}", unsafe_allow_html=True)
            if item.input_url:
                info.caption(item.input_url)
            when.caption(format_display_time(item.created_at, services.settings.display_timezone))
            open_col.button("Open", key=f"open_{item.id}", on_click=_open, args=(item.id,), use_container_width=True)
            if delete_col.button("Delete", key=f"del_{item.id}", use_container_width=True):
                try:
                    services.repository.delete(item.id)
                except HistoryError as exc:
                    st.error(exc.user_message)
                st.rerun()

    with st.expander("Manage stored data"):
        st.caption("Investigations (including resume-derived skills) are stored only in a local SQLite file on this machine.")
        if st.button("Delete all history"):
            try:
                st.success(f"Deleted {services.repository.delete_all()} investigation(s).")
            except HistoryError as exc:
                st.error(exc.user_message)
        if st.button("Clear cached search results"):
            try:
                st.success(f"Cleared {services.cache.clear()} cached search response(s).")
            except sqlite3.Error:
                st.error("The search cache could not be cleared. Check that the data folder is writable.")
