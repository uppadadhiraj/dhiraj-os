"""Home: paste a URL, optionally upload a resume and set preferences, then investigate."""
from __future__ import annotations

import streamlit as st

from models.preferences import UserPreferences
from services.pipeline import InvestigationRequest
from services.skills import normalize_skill
from ui.state import get_services, go
from ui.styles import esc


def _hero() -> None:
    st.markdown(
        '<div class="sl-hero"><div class="sl-eyebrow">Opportunity investigation agent</div>'
        "<h1>Investigate the opportunity<br><em>before you invest your time.</em></h1>"
        "<p>Most job platforms tell you what the listing says. ScoutLens investigates what the listing "
        "doesn’t tell you: the company, its other openings, the market and how you compare, "
        "with every claim linked to a source.</p></div>",
        unsafe_allow_html=True,
    )


def _setup_notice(configured: bool) -> None:
    if configured:
        return
    st.markdown(
        '<div class="sl-notice sl-warnbox"><b>Live search is not configured.</b> Add your SerpApi key to a <code>.env</code> '
        "file (<code>SERPAPI_KEY=…</code>, see <code>.env.example</code>) and restart to run real investigations. "
        "You can still explore everything with the demo below.</div>",
        unsafe_allow_html=True,
    )


def _parse_skills(raw: str) -> list[str]:
    """Comma-separated skills -> canonical names; unknown entries are dropped (and shown to the user)."""
    names = [normalize_skill(part) for part in raw.replace(";", ",").split(",") if part.strip()]
    return list(dict.fromkeys(n for n in names if n))


def _needs_company_panel() -> bool:
    """Recovery flow: the listing was read, but no employer name was found. Returns True if it handled the page."""
    opp = st.session_state.get("needs_company_opportunity")
    if opp is None:
        return False
    st.markdown(
        f'<div class="sl-notice sl-warnbox">The listing for <b>{esc(opp.role_title or "this role")}</b> was read, but the '
        "company name could not be found. Enter it to continue with everything extracted so far.</div>",
        unsafe_allow_html=True,
    )
    with st.form("needs_company_form"):
        company = st.text_input("Company name", placeholder="e.g. Acme Robotics")
        col_a, col_b = st.columns([1, 1])
        submit = col_a.form_submit_button("Continue investigation", type="primary", use_container_width=True)
        cancel = col_b.form_submit_button("Start over", use_container_width=True)
    if cancel:
        st.session_state.pop("needs_company_opportunity", None)
        st.rerun()
    if submit:
        if not company.strip():
            st.error("Please enter the company name.")
            return True
        base = st.session_state.get("draft_request") or InvestigationRequest()
        base.opportunity, base.company = opp, company.strip()
        st.session_state.pop("needs_company_opportunity", None)
        st.session_state["pending_request"] = base
        go("investigation")
    return True


def _public_demo_home() -> None:
    """Hosted showcase: only the built-in demo is available (no URL fetching, uploads or stored history)."""
    st.markdown(
        '<div class="sl-notice sl-warnbox"><b>Public demo.</b> This hosted copy runs the built-in demo investigation only: '
        "a fictional company with recorded responses, through the real analysis pipeline. Live investigations need a "
        "SerpApi key and are disabled here; nothing you do on this page is stored. "
        'Run it locally for live searches (see the <a href="https://github.com/uppadadhiraj/ScoutLens" '
        'target="_blank" rel="noopener noreferrer">README</a>).</div>',
        unsafe_allow_html=True,
    )
    if st.button("Try the demo", type="primary"):
        st.session_state["pending_request"] = InvestigationRequest(demo=True)
        go("investigation")


def render() -> None:
    services = get_services()
    status = services.settings.public_status()
    _hero()
    if status["public_demo"]:
        _public_demo_home()
        return
    _setup_notice(bool(status["serpapi_configured"]))
    if _needs_company_panel():
        return

    draft: dict = st.session_state.get("draft", {})
    error = st.session_state.pop("read_error", None)
    if error:
        st.error(error)

    with st.form("investigate", border=False):
        url = st.text_input(
            "Paste an opportunity URL", value=draft.get("url", ""),
            placeholder="https://company.com/careers/software-engineer-intern",
        )
        upload = st.file_uploader("Upload your resume (optional · PDF, analysed locally)", type=["pdf"], accept_multiple_files=False)
        if draft.get("resume_bytes") and not upload:
            st.caption("📎 Your resume from the previous attempt will be reused unless you upload a new one.")

        with st.expander("Optional preferences"):
            c1, c2 = st.columns(2)
            location = c1.text_input("Location", value=draft.get("location", ""), placeholder="e.g. Pune, India")
            target_role = c2.text_input("Target role", value=draft.get("target_role", ""), placeholder="e.g. Data Engineer")
            c3, c4 = st.columns(2)
            salary = c3.text_input("Salary / stipend", value=draft.get("salary", ""))
            experience = c4.text_input("Experience", value=draft.get("experience", ""), placeholder="e.g. 0-2 years")
            skills = st.text_input("Your skills (comma-separated)", value=draft.get("skills", ""), placeholder="Python, SQL, Docker")

        with st.expander("Can’t open the link? Paste the job description instead", expanded=bool(error)):
            company = st.text_input("Company name", value=draft.get("company", ""), placeholder="Required when pasting a description")
            role = st.text_input("Role title (optional)", value=draft.get("role", ""))
            pasted = st.text_area("Job description", value=draft.get("pasted", ""), height=160, placeholder="Paste the full listing text here…")

        col_go, col_demo, _ = st.columns([1.2, 1.2, 3])
        investigate = col_go.form_submit_button("Investigate", type="primary", use_container_width=True)
        demo = col_demo.form_submit_button("Try the demo", use_container_width=True)

    st.markdown(
        '<div class="sl-powered">Powered by live web search through <b>SerpApi</b> · Google Search, Jobs and News · '
        "Your resume is parsed on your machine and never sent to a language model.</div>",
        unsafe_allow_html=True,
    )
    if not (investigate or demo):
        return

    if demo:
        st.session_state["pending_request"] = InvestigationRequest(demo=True)
        go("investigation")

    if not url.strip() and not pasted.strip():
        st.error("Paste an opportunity URL, or paste the job description.")
        return
    if pasted.strip() and not company.strip():
        st.error("Please enter the company name when pasting a job description.")
        return

    parsed_skills = _parse_skills(skills)
    unknown = [s for s in skills.replace(";", ",").split(",") if s.strip() and not normalize_skill(s)]
    if unknown:
        st.info(f"Skills not recognised and ignored: {', '.join(u.strip() for u in unknown)}")
    resume_bytes = upload.getvalue() if upload else draft.get("resume_bytes")
    request = InvestigationRequest(
        url=url.strip() or None, pasted_text=pasted.strip() or None, company=company.strip() or None,
        role=role.strip() or None, resume_bytes=resume_bytes,
        prefs=UserPreferences(
            location=location.strip() or None, target_role=target_role.strip() or None,
            salary=salary.strip() or None, experience=experience.strip() or None, skills=parsed_skills,
        ),
    )
    st.session_state["draft"] = {
        "url": url, "location": location, "target_role": target_role, "salary": salary, "experience": experience,
        "skills": skills, "company": company, "role": role, "pasted": pasted, "resume_bytes": resume_bytes,
    }
    st.session_state["draft_request"] = request
    st.session_state["pending_request"] = request
    go("investigation")
