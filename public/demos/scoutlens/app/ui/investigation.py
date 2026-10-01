"""Investigation: runs the pipeline and shows each real stage as it happens (nothing is simulated)."""
from __future__ import annotations

import logging
import time

import streamlit as st

from agents.investigator import STAGES, ProgressEvent
from models.report import InvestigationReport
from services.cache.repository import HistoryError
from services.pipeline import InvestigationRequest, NeedsCompanyError, run_pipeline
from ui.components import demo_banner, steps_html
from ui.state import get_services, go
from utils.errors import ExtractionError, InvalidURLError, ScoutLensError, SerpApiError

logger = logging.getLogger(__name__)


def _open_report() -> None:
    st.session_state["view"] = "report"


def _back_home() -> None:
    st.session_state["view"] = "home"


def _target(request: InvestigationRequest) -> str:
    if request.demo:
        return "the built-in demo (fictional company, recorded responses)"
    if request.url:
        return request.url
    if request.opportunity and request.opportunity.source_url:
        return request.opportunity.source_url
    return "the pasted job description"


def _persist(report: InvestigationReport) -> None:
    if get_services().settings.public_demo:
        return  # hosted showcase: keep nothing, so visitors can never see each other's runs
    try:
        get_services().repository.save(report)
    except HistoryError as exc:
        st.warning(f"The report could not be saved to history: {exc.user_message}")


def render() -> None:
    request: InvestigationRequest | None = st.session_state.pop("pending_request", None)
    if request is None:
        # Reached without anything to run (e.g. a browser refresh): go somewhere sensible.
        st.session_state["view"] = "report" if st.session_state.get("report") else "home"
        st.rerun()
        return

    services = get_services()
    st.markdown(
        '<div class="sl-eyebrow">ScoutLens investigation</div>'
        f"<h2>Investigating {'the demo' if request.demo else 'the opportunity'}</h2>",
        unsafe_allow_html=True,
    )
    st.caption(f"Source: {_target(request)}" + (" · bypassing the cache (refresh)" if request.refresh else ""))
    if request.demo:
        st.markdown(demo_banner("Demo data: no live search is made. The real analysis pipeline runs on recorded, synthetic responses."), unsafe_allow_html=True)

    states: dict[str, tuple[str, str]] = {key: ("pending", "") for key, _ in STAGES}
    labels = dict(STAGES)
    slot = st.empty()

    def draw() -> None:
        slot.markdown(steps_html([(k, labels[k], *states[k]) for k, _ in STAGES]), unsafe_allow_html=True)

    def on_progress(event: ProgressEvent) -> None:
        states[event.stage] = (event.status, event.detail)
        draw()

    draw()
    started = time.perf_counter()
    report: InvestigationReport | None = None
    failure: str | None = None
    try:
        report = run_pipeline(request, services.settings, on_progress=on_progress)
    except NeedsCompanyError as exc:
        st.session_state["needs_company_opportunity"] = exc.opportunity
    except (InvalidURLError, ExtractionError) as exc:
        st.session_state["read_error"] = exc.user_message
    except ScoutLensError as exc:
        failure = exc.user_message
        if isinstance(exc, SerpApiError) and exc.kind in ("no_key", "invalid_key"):
            failure += " Live search needs a valid SerpApi key; you can still try the demo from the home page."
    except Exception:  # noqa: BLE001 - the UI must never show a traceback
        logger.exception("Unexpected error while investigating")
        failure = "Something went wrong while investigating. Please try again; if it keeps happening, check the logs."

    if st.session_state.get("needs_company_opportunity") or st.session_state.get("read_error"):
        go("home")
    if failure:
        st.error(failure)
        st.button("← Back to start", on_click=_back_home)
        return
    assert report is not None
    _persist(report)
    st.session_state["report"] = report
    st.session_state["last_request"] = request
    elapsed = time.perf_counter() - started
    if report.status == "partial":
        st.warning("The investigation finished with some gaps. The report explains what is missing.")
    st.success(f"Investigation complete in {elapsed:.1f}s: {len(report.findings)} findings from {len(report.evidence)} evidence items.")
    st.button("Open report →", type="primary", on_click=_open_report)
