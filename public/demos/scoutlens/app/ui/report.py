"""Report: the evidence-backed dashboard for one investigation."""
from __future__ import annotations

import streamlit as st

from models.evidence import EvidenceItem
from models.preferences import UserPreferences
from models.report import InvestigationReport
from services.pipeline import InvestigationRequest
from ui.components import (
    cited_text, comparison_card, crosscheck_card, demo_banner, evidence_card, finding_card, fit_row,
    metrics, news_card, notice, search_table, skill_bars, skills_block, snapshot,
)
from ui.state import get_services, go
from ui.styles import badge, bar, card, chips, esc, kv_grid, label, link, tier_badge

_LIMITATIONS = (
    "Job and market figures describe what Google Jobs returned for each search, not a random sample of the whole market.",
    "Skill detection is keyword-based on listing text; it can miss skills that are described in other words.",
    "Company facts come from search-result excerpts and Google's knowledge panel; they are cited but not independently verified.",
    "Listing extraction is heuristic. Check the extracted fields against the original listing before relying on them.",
    "ScoutLens informs your decision; it does not tell you whether to apply.",
)


def _refresh_request(report: InvestigationReport) -> InvestigationRequest:
    opp = report.opportunity
    if report.is_demo:
        return InvestigationRequest(demo=True, refresh=True)
    prefs = report.preferences or UserPreferences()
    resume = report.resume if report.resume and report.resume.source == "pdf" else None
    manual = lambda name: opp.field_sources.get(name) == "manual"  # noqa: E731
    if opp.source_url and opp.extraction_method != "manual":
        return InvestigationRequest(
            url=opp.source_url, resume_profile=resume, prefs=prefs, refresh=True,
            company=opp.company_name if manual("company_name") else None,
            role=opp.role_title if manual("role_title") else None,
            location=opp.location if manual("location") else None,
        )
    return InvestigationRequest(opportunity=opp.model_copy(deep=True), resume_profile=resume, prefs=prefs, refresh=True)


def _provenance_line(report: InvestigationReport) -> str:
    m = report.method
    if report.is_demo:
        return f"Demo data · generated {esc(m.displayed_time)} · recorded responses replayed, no live search"
    return (
        f"Investigated {esc(m.displayed_time)} · Powered by live web search through <b>SerpApi</b> · "
        f"{m.searches_performed} searches ({m.searches_live} live, {m.searches_cached} from cache)"
    )


def _header(report: InvestigationReport) -> None:
    opp = report.opportunity
    chip_items = [opp.job_type, opp.location, opp.remote_or_onsite]
    st.markdown(
        f'<div class="sl-eyebrow">Investigation report</div>'
        f"<h2 style='margin-bottom:.2rem'>{esc(opp.role_title or 'Role not identified')} "
        f"<span class='sl-muted' style='font-weight:500'>at</span> {esc(opp.company_name)}</h2>"
        f'{chips([c for c in chip_items if c])}'
        f'<div class="sl-ev-meta">{_provenance_line(report)}</div>',
        unsafe_allow_html=True,
    )
    if report.is_demo:
        st.markdown(demo_banner("Demo data: a fictional company and recorded, synthetic responses run through the real analysis pipeline."), unsafe_allow_html=True)
    for warning in report.warnings:
        st.warning(warning)
    if report.status == "partial" and not report.warnings:
        st.warning("This investigation is partial: some steps did not complete.")


def _actions_row(report: InvestigationReport) -> None:
    refresh, download, new, _ = st.columns([1.5, 1.5, 1.3, 3.5])
    if refresh.button("↻ Refresh investigation", use_container_width=True, help="Run the searches again, bypassing the cache"):
        st.session_state["pending_request"] = _refresh_request(report)
        go("investigation")
    download.download_button(
        "⬇ Download JSON", data=report.model_dump_json(indent=2), file_name=f"scoutlens-{report.id}.json",
        mime="application/json", use_container_width=True,
    )
    if new.button("＋ New investigation", use_container_width=True):
        go("home")


# ---------------------------------------------------------------------- tabs

def _tab_overview(report: InvestigationReport, by_id: dict[str, EvidenceItem]) -> None:
    opp = report.opportunity
    st.markdown("#### Opportunity snapshot")
    st.markdown(snapshot(opp), unsafe_allow_html=True)
    for note in opp.notes:
        st.markdown(notice(note, "warn"), unsafe_allow_html=True)
    st.markdown(skills_block(opp), unsafe_allow_html=True)
    if opp.responsibilities or opp.qualifications:
        with st.expander("Responsibilities and qualifications from the listing"):
            if opp.responsibilities:
                st.markdown("**Responsibilities**\n\n" + "\n".join(f"- {r}" for r in opp.responsibilities))
            if opp.qualifications:
                st.markdown("**Qualifications**\n\n" + "\n".join(f"- {q}" for q in opp.qualifications))

    st.markdown("### What you might have missed")
    st.caption("Findings that are not obvious from the listing alone. Each one states the fact, what it might mean, and cites its sources.")
    if not report.findings:
        st.markdown(notice("No additional findings were supported by the evidence retrieved for this investigation.", "gap"), unsafe_allow_html=True)
    for finding in report.findings:
        st.markdown(finding_card(finding, by_id), unsafe_allow_html=True)
        with st.expander(f"Evidence for “{finding.title}” ({len(finding.evidence_ids)})"):
            for evidence_id in finding.evidence_ids[:12]:
                if evidence_id in by_id:
                    st.markdown(evidence_card(by_id[evidence_id]), unsafe_allow_html=True)
            if len(finding.evidence_ids) > 12:
                st.caption(f"+ {len(finding.evidence_ids) - 12} more in the Evidence tab")

    st.markdown("### Suggested next actions")
    st.caption("A neutral checklist. You decide what is worth doing.")
    for i, action in enumerate(report.next_actions):
        st.checkbox(action.text, key=f"act_{report.id}_{i}", help=action.reason or None)
        if action.reason:
            st.caption(action.reason)


def _tab_company(report: InvestigationReport, by_id: dict[str, EvidenceItem]) -> None:
    company = report.company
    if company is None:
        st.markdown(notice("Insufficient evidence: the company investigation did not complete.", "gap"), unsafe_allow_html=True)
        return
    st.markdown("#### Company overview")
    if company.overview:
        source = {"knowledge_graph": "Google knowledge panel", "llm": "Language-model summary (every sentence cited)", "search_snippet": "Search-result excerpt"}[company.overview_source or "search_snippet"]
        st.markdown(card(f'<div class="sl-fact">{cited_text(company.overview, by_id)}</div><div class="sl-sources">{badge(source, "muted")} '
                         f'{"".join(_tier_of(by_id, i) for i in company.overview_evidence_ids[:1])} {_refs(company.overview_evidence_ids, by_id)}</div>'), unsafe_allow_html=True)
    pairs = [("Official website", None), ("Industry", company.industry)]
    pairs += [(k.title(), f.text) for k, f in company.attributes.items()]
    grid = kv_grid([p for p in pairs if p[0] != "Official website"])
    if company.website:
        basis = f'<div class="sl-ev-meta">{esc(company.website_basis or "")} {_refs(company.website_evidence_ids, by_id)}</div>'
        st.markdown(card(f'{label("Official website")}<div class="sl-fact">{link(company.website, company.website)}</div>{basis}'), unsafe_allow_html=True)
    st.markdown(grid, unsafe_allow_html=True)

    if company.products:
        st.markdown("#### Products and services")
        st.caption("Verbatim excerpts from search results, not our paraphrase.")
        for fact in company.products:
            st.markdown(card(f'<div class="sl-interp">“{esc(fact.text)}”</div><div class="sl-sources">{_refs(fact.evidence_ids, by_id)}</div>', "sl-tight"), unsafe_allow_html=True)
    if company.funding:
        st.markdown("#### Funding coverage")
        st.caption("As reported by the cited sources; not independently verified.")
        for fact in company.funding:
            st.markdown(card(f'<div class="sl-interp">“{esc(fact.text)}”</div><div class="sl-sources">{_refs(fact.evidence_ids, by_id)}</div>', "sl-tight"), unsafe_allow_html=True)
    for gap in company.gaps:
        st.markdown(notice(gap, "gap"), unsafe_allow_html=True)

    st.markdown("#### Recent news")
    news = report.news
    if news is None:
        st.markdown(notice("Insufficient evidence: the news search did not complete.", "gap"), unsafe_allow_html=True)
        return
    for item in news.items:
        st.markdown(news_card(item), unsafe_allow_html=True)
    for note in news.notes:
        st.markdown(notice(note, "gap"), unsafe_allow_html=True)


def _tab_hiring_market(report: InvestigationReport, by_id: dict[str, EvidenceItem]) -> None:
    hiring = report.hiring
    st.markdown("#### Current company hiring signals")
    if hiring is None:
        st.markdown(notice("Insufficient evidence: the hiring search did not complete.", "gap"), unsafe_allow_html=True)
    elif not hiring.has_data:
        st.markdown(notice("Insufficient evidence: no other current listings from this employer were found.", "gap"), unsafe_allow_html=True)
    else:
        st.markdown(f"**Among the {hiring.sample_size} other current listings analysed** from {esc(hiring.company)} "
                    f"({hiring.similar_count} with a title similar to this role):", unsafe_allow_html=True)
        st.markdown(skill_bars(hiring.skill_frequencies), unsafe_allow_html=True)
        st.caption("Highlighted skills are not mentioned in the original listing. Percentages are computed only from the listings above.")
        for comparison in hiring.comparisons:
            st.markdown(comparison_card(comparison, by_id), unsafe_allow_html=True)
        cols = st.columns(3)
        if hiring.locations:
            cols[0].markdown("**Locations**\n\n" + "\n".join(f"- {loc.location} ×{loc.count}" for loc in hiring.locations))
        if hiring.work_modes:
            cols[1].markdown("**Work arrangement stated**\n\n" + "\n".join(f"- {k} ×{v}" for k, v in hiring.work_modes.items()))
        if hiring.salary_examples:
            cols[2].markdown(f"**Salaries stated ({hiring.salary_listed_count})**\n\n" + "\n".join(f"- {s}" for s in hiring.salary_examples))
        with st.expander(f"The {len(hiring.listing_evidence_ids)} listings analysed"):
            for evidence_id in hiring.listing_evidence_ids:
                if evidence_id in by_id:
                    e = by_id[evidence_id]
                    st.markdown(f"{tier_badge(e.tier, e.tier_label)} {link(e.source_title, e.source_url)} "
                                f"<span class='sl-muted'>· {esc(e.publisher or '')}</span>", unsafe_allow_html=True)
        for note in hiring.notes:
            st.markdown(notice(note, "gap"), unsafe_allow_html=True)

    st.markdown("#### Market skill signals")
    market = report.market
    if market is None:
        st.markdown(notice("Insufficient evidence: the market sample did not complete.", "gap"), unsafe_allow_html=True)
        return
    st.markdown(notice(market.method), unsafe_allow_html=True)
    for note in market.notes:
        st.markdown(notice(note, "warn" if market.low_sample else "gap"), unsafe_allow_html=True)
    status_badge = {"matched": ("on your resume", "ok"), "partial": ("partial on resume", "warn"), "not_found": ("not found on resume", "muted"), "unknown": ("resume too limited to tell", "violet")}
    for signal in market.signals:
        extra = ""
        if signal.resume_status:
            text, kind = status_badge[signal.resume_status]
            extra = badge(text, kind)
        st.markdown(
            card(bar(signal.skill, signal.count, signal.total, signal.percent, highlight=signal.missing_from_resume is True,
                     note="named in the listing" if signal.scope == "in_listing" else "common in the sample")
                 + f'<div class="sl-fact">{esc(signal.statement)} {extra}</div><div class="sl-interp">{esc(signal.interpretation)}</div>'
                 + (f'<div class="sl-action">{esc(signal.action)}</div>' if signal.action else "")
                 + f'<div class="sl-sources">{_refs(signal.evidence_ids, by_id, 6)}</div>', "sl-tight"),
            unsafe_allow_html=True,
        )


def _tab_fit(report: InvestigationReport) -> None:
    fit = report.fit
    if fit is None:
        st.markdown(notice("Upload a resume PDF, or enter your skills in the preferences on the home page, to see how your profile compares with this opportunity.", "gap"), unsafe_allow_html=True)
        return
    coverage = f"{fit.coverage_percent:g}%" if fit.coverage_percent is not None else "n/a"
    st.markdown(
        f'<div class="sl-metrics"><div class="sl-metric"><div class="sl-metric-v">{coverage}</div><div class="sl-metric-k">Skill coverage</div>'
        f'<div class="sl-metric-d">{fit.matched} of {fit.total_requirements} listed skills matched</div></div>'
        f'<div class="sl-metric"><div class="sl-metric-v">{fit.partial}</div><div class="sl-metric-k">Partial</div></div>'
        f'<div class="sl-metric"><div class="sl-metric-v">{fit.not_found}</div><div class="sl-metric-k">Not found in resume</div></div>'
        f'<div class="sl-metric"><div class="sl-metric-v">{fit.unknown}</div><div class="sl-metric-k">Unknown</div></div></div>',
        unsafe_allow_html=True,
    )
    for status, heading in (("matched", "Matched"), ("partial", "Partial matches"), ("not_found", "Not found in resume"), ("unknown", "Unknown")):
        rows = [m for m in fit.matches if m.status == status]
        if rows:
            st.markdown(f"**{heading}**")
            st.markdown(card("".join(fit_row(m) for m in rows), "sl-tight"), unsafe_allow_html=True)
    for line in fit.context:
        st.markdown(notice(line), unsafe_allow_html=True)
    for note in fit.notes:
        st.markdown(notice(note, "gap"), unsafe_allow_html=True)
    resume = report.resume
    if resume and resume.source == "pdf":
        with st.expander("What was read from your resume"):
            st.markdown(kv_grid([("Name", resume.name), ("Programming languages", ", ".join(resume.programming_languages)),
                                 ("Frameworks", ", ".join(resume.frameworks)), ("Tools & platforms", ", ".join(resume.tools)),
                                 ("Projects", len(resume.projects)), ("Experience entries", len(resume.experience))]), unsafe_allow_html=True)
            if resume.education:
                st.markdown("**Education**\n\n" + "\n".join(f"- {e}" for e in resume.education))
            if resume.certifications:
                st.markdown("**Certifications**\n\n" + "\n".join(f"- {c}" for c in resume.certifications))
            for note in resume.notes:
                st.caption(note)


def _tab_evidence(report: InvestigationReport, by_id: dict[str, EvidenceItem]) -> None:
    m = report.method
    tz = get_services().settings.display_timezone
    st.markdown("#### Investigation method")
    if report.is_demo:
        st.markdown(notice("Demo data: these searches were replayed from recorded, synthetic responses. A real investigation runs the same "
                           "pipeline against live Google Search, Google Jobs and Google News through SerpApi."), unsafe_allow_html=True)
    else:
        st.markdown(notice("Powered by live web search through SerpApi. Cached results are labelled below with the time they were originally retrieved."), unsafe_allow_html=True)
    st.markdown(kv_grid([
        ("Search timestamp", m.displayed_time), ("Searches performed", f"{m.searches_performed} ({m.searches_live} live · {m.searches_cached} cached · {m.searches_failed} failed)"),
        ("APIs used", ", ".join(m.apis_used)), ("Job listings analysed", f"{m.company_listings_analyzed} from this employer + {m.market_listings_analyzed} market sample"),
        ("News results analysed", m.news_results_analyzed), ("Sources retained as evidence", m.sources_retained),
        ("Language model", (f"{m.llm} · used for {', '.join(m.llm_used_for)}" if m.llm else "Not used (deterministic analysis)")),
        ("Cache", "Bypassed (refresh)" if m.refreshed else "Used where fresh"),
    ]), unsafe_allow_html=True)
    for note in m.plan_notes:
        st.caption("• " + note)
    st.markdown(f'<div class="sl-card">{search_table(m.searches, tz)}</div>', unsafe_allow_html=True)

    if report.crosschecks:
        st.markdown("#### Cross-checks")
        for check in report.crosschecks:
            st.markdown(crosscheck_card(check, by_id), unsafe_allow_html=True)

    st.markdown("#### Evidence and sources")
    st.caption("Every source shown here was returned by a real search result or read from the listing page. "
               "Tier 1: official / government / university · Tier 2: established news and industry · Tier 3: aggregators, forums, unclassified.")
    c1, c2 = st.columns(2)
    tiers = c1.multiselect("Source tier", [1, 2, 3], default=[1, 2, 3], key=f"tier_{report.id}")
    kinds = sorted({e.source_type for e in report.evidence})
    types = c2.multiselect("Source type", kinds, default=kinds, key=f"type_{report.id}")
    shown = [e for e in report.evidence if e.tier in tiers and e.source_type in types]
    st.caption(f"{len(shown)} of {len(report.evidence)} evidence items")
    for item in sorted(shown, key=lambda e: (e.tier, int(e.id[1:])))[:80]:
        st.markdown(evidence_card(item), unsafe_allow_html=True)
    if len(shown) > 80:
        st.caption(f"Showing the first 80. Download the JSON for all {len(shown)}.")

    st.markdown("#### Limitations")
    st.markdown("\n".join(f"- {line}" for line in _LIMITATIONS))


def _tier_of(by_id: dict[str, EvidenceItem], evidence_id: str) -> str:
    item = by_id.get(evidence_id)
    return tier_badge(item.tier, item.tier_label) if item else ""


def _refs(ids: list[str], by_id: dict[str, EvidenceItem], limit: int = 8) -> str:
    from ui.components import evidence_refs

    return f"Sources: {evidence_refs(ids, by_id, limit)}" if ids else ""


def render() -> None:
    report: InvestigationReport | None = st.session_state.get("report")
    if not isinstance(report, InvestigationReport):
        st.markdown(notice("No report is open. Start an investigation, or open one from history.", "gap"), unsafe_allow_html=True)
        if st.button("Start an investigation"):
            go("home")
        return
    by_id = report.evidence_by_id()
    _header(report)
    _actions_row(report)
    st.markdown(metrics(report.indicators), unsafe_allow_html=True)
    overview, company, hiring, fit, evidence = st.tabs(["Overview", "Company", "Hiring & market", "Personal fit", "Evidence & method"])
    with overview:
        _tab_overview(report, by_id)
    with company:
        _tab_company(report, by_id)
    with hiring:
        _tab_hiring_market(report, by_id)
    with fit:
        _tab_fit(report)
    with evidence:
        _tab_evidence(report, by_id)
