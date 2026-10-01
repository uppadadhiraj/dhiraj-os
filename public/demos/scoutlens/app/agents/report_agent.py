"""Report Agent: turns the structured analysis results into the report's transparent supporting parts.

Everything here is derived from data already collected: indicators (independent measures, never a
combined score), the investigation method (what was searched, when, live or cached), and a neutral
action checklist. Nothing is decided for the user.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from models.company import CompanyProfile
from models.opportunity import OpportunityProfile
from models.report import (
    Finding,
    HiringSignal,
    Indicator,
    InvestigationMethod,
    MarketAnalysis,
    NewsSignal,
    NextAction,
)
from models.resume import FitSummary
from models.search import SearchRecord
from services.evidence.store import EvidenceStore
from utils.domains import is_job_board_or_ats

_ENGINE_NAMES = {"google": "Google Search", "google_jobs": "Google Jobs", "google_news": "Google News"}
MAX_ACTIONS = 8


def format_display_time(moment: datetime, tz_name: str) -> str:
    """"2026-09-30 16:32 IST": the moment the (live) data was retrieved, in the configured timezone."""
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        zone = ZoneInfo("UTC")
    return moment.astimezone(zone).strftime("%Y-%m-%d %H:%M %Z")


def build_method(
    *,
    started_at: datetime,
    finished_at: datetime,
    records: list[SearchRecord],
    hiring: HiringSignal | None,
    market: MarketAnalysis | None,
    news: NewsSignal | None,
    store: EvidenceStore,
    refreshed: bool,
    llm_status: str | None,
    llm_used_for: list[str],
    plan_notes: list[str],
    tz_name: str,
) -> InvestigationMethod:
    return InvestigationMethod(
        started_at=started_at,
        finished_at=finished_at,
        displayed_time=format_display_time(started_at, tz_name),
        searches=records,
        apis_used=[_ENGINE_NAMES[e] for e in dict.fromkeys(r.engine for r in records)],
        company_listings_analyzed=hiring.sample_size if hiring else 0,
        market_listings_analyzed=market.sample_size if market else 0,
        news_results_analyzed=news.total_found if news else 0,
        sources_retained=len(store),
        refreshed=refreshed,
        llm=llm_status if llm_used_for else None,
        llm_used_for=llm_used_for,
        plan_notes=plan_notes,
    )


def build_indicators(
    *,
    hiring: HiringSignal | None,
    market: MarketAnalysis | None,
    news: NewsSignal | None,
    fit: FitSummary | None,
    records: list[SearchRecord],
    store: EvidenceStore,
) -> list[Indicator]:
    indicators: list[Indicator] = []
    if fit and fit.coverage_percent is not None:
        detail = f"{fit.matched} of {fit.total_requirements} listed skills matched"
        if fit.partial or fit.unknown:
            detail += f"; {fit.partial} partial, {fit.unknown} unknown"
        indicators.append(Indicator(label="Resume skill coverage", value=f"{fit.coverage_percent:g}%", detail=detail))
    if hiring is not None:
        indicators.append(Indicator(
            label="Sampled related listings", value=str(hiring.sample_size),
            detail=f"other current listings from {hiring.company}",
        ))
    if market is not None:
        indicators.append(Indicator(label="Market sample", value=str(market.sample_size), detail=f"listings for '{market.role_query}'"))
    indicators.append(Indicator(
        label="Search results analyzed", value=str(sum(r.result_count for r in records)),
        detail=f"across {len(records)} searches",
    ))
    if news is not None:
        indicators.append(Indicator(label="Recent news items", value=str(len(news.items)), detail=f"{news.total_found} results retrieved"))
    tiers = Counter(e.tier for e in store.items)
    indicators.append(Indicator(
        label="Evidence items", value=str(len(store)),
        detail=f"Tier 1: {tiers[1]} · Tier 2: {tiers[2]} · Tier 3: {tiers[3]}",
    ))
    return indicators


def build_next_actions(
    *,
    opp: OpportunityProfile,
    company: CompanyProfile | None,
    hiring: HiringSignal | None,
    market: MarketAnalysis | None,
    fit: FitSummary | None,
    findings: list[Finding],
    listing_evidence_id: str | None,
    store: EvidenceStore,
) -> list[NextAction]:
    """A neutral checklist. Each item says why it is listed; none tells the user what to decide."""
    actions: list[NextAction] = []
    listing_ids = [listing_evidence_id] if listing_evidence_id else []

    if opp.application_deadline:
        actions.append(NextAction(
            text=f"Verify the application deadline ({opp.application_deadline})",
            reason="The deadline comes from the listing text and may be outdated.", evidence_ids=listing_ids,
        ))
    else:
        actions.append(NextAction(text="Check whether the listing states an application deadline", reason="None was found in the listing text."))

    source = opp.source_url or ""
    if not source or is_job_board_or_ats(source) or (hiring and not hiring.original_found):
        website = company.website_evidence_ids if company else []
        actions.append(NextAction(
            text="Confirm the listing on the company's official careers page",
            reason="The listing was not read from the company's own site, or was not seen in Google Jobs results.",
            evidence_ids=website or listing_ids,
        ))

    if fit:
        gaps = [m for m in fit.matches if m.status in ("not_found", "partial") and m.requirement == "required"]
        by_skill = {s.skill: s for s in (market.signals if market else [])}
        for match in sorted(gaps, key=lambda m: -(by_skill[m.skill].percent if m.skill in by_skill else 0))[:2]:
            signal = by_skill.get(match.skill)
            reason = (f"{match.skill} is required in the listing ({match.basis.lower()})."
                      + (f" It appears in {signal.percent:g}% of sampled listings." if signal else ""))
            actions.append(NextAction(text=f"Review {match.skill} basics", reason=reason, evidence_ids=(signal.evidence_ids[:5] if signal else [])))
        for match in [m for m in fit.matches if m.status == "matched" and m.requirement == "required"][:2]:
            actions.append(NextAction(
                text=f"Prepare {match.skill} interview questions",
                reason=f"{match.skill} is required in the listing and appears on your resume.",
            ))
    else:
        for skill in opp.required_skills[:2]:
            actions.append(NextAction(text=f"Prepare {skill} interview questions", reason=f"{skill} is required in the listing."))

    if company and company.products:
        actions.append(NextAction(
            text="Research the company's product and services", reason="Excerpts describing the business were found.",
            evidence_ids=company.products[0].evidence_ids,
        ))
    if hiring and hiring.similar_count:
        actions.append(NextAction(
            text=f"Compare {hiring.similar_count} similar current role{'s' if hiring.similar_count != 1 else ''} at the company",
            reason="Other listings with similar titles were found.", evidence_ids=hiring.listing_evidence_ids[:5],
        ))
    for finding in findings:
        if finding.action and finding.action not in {a.text for a in actions}:
            actions.append(NextAction(text=finding.action.rstrip("."), reason=finding.title, evidence_ids=finding.evidence_ids[:5]))

    seen: set[str] = set()
    unique = []
    for action in actions:
        key = action.text.lower()
        if key not in seen:
            seen.add(key)
            unique.append(action)
    return unique[:MAX_ACTIONS]
