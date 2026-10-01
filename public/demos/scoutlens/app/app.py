"""ScoutLens entry point: `streamlit run app.py`.

A tiny router. Pages live in ``ui/`` (not ``pages/``) so Streamlit's automatic multipage sidebar
does not appear; navigation is the top bar below.
"""
from __future__ import annotations

import logging

import streamlit as st

from config import get_settings
from ui import history, home, investigation, report
from ui.state import init_state
from ui.styles import inject_css
from utils.logging_setup import setup_logging

st.set_page_config(page_title="ScoutLens", page_icon="🔎", layout="wide", initial_sidebar_state="collapsed")

logger = logging.getLogger("scoutlens.app")
_VIEWS = {
    "home": home.render,
    "investigation": investigation.render,
    "report": report.render,
    "history": history.render,
}
_NAV = {"Investigate": "home", "Report": "report", "History": "history"}
_ACTIVE_LABEL = {"home": "Investigate", "investigation": "Investigate", "report": "Report", "history": "History"}


def _on_nav() -> None:
    """User clicked the top bar. A deselect (None) is ignored; the control is re-synced on the next run."""
    target = _NAV.get(st.session_state.get("nav_choice") or "")
    if target is None:
        return
    if target == "report" and not st.session_state.get("report"):
        st.toast("Run or open an investigation first.")
        return
    st.session_state["view"] = target


def _nav() -> None:
    # Set before the widget is created so programmatic view changes (e.g. after a run) are reflected.
    st.session_state["nav_choice"] = _ACTIVE_LABEL[st.session_state["view"]]
    brand, _spacer, nav = st.columns([1.4, 2.6, 3])
    brand.markdown('<div class="sl-brand">SCOUT<span>LENS</span> 🔎</div>', unsafe_allow_html=True)
    nav.segmented_control("Navigation", list(_NAV), key="nav_choice", on_change=_on_nav, label_visibility="collapsed")


def main() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    init_state()
    inject_css()
    _nav()
    render_view = _VIEWS.get(st.session_state["view"], home.render)
    try:
        render_view()
    except Exception:  # noqa: BLE001 - never show a traceback to the user (Streamlit control-flow exceptions are BaseException)
        logger.exception("Unhandled error while rendering %s", st.session_state["view"])
        st.error("Something went wrong while displaying this page. Please go back and try again.")
        if st.button("← Back to start"):
            st.session_state["view"] = "home"
            st.rerun()


main()
