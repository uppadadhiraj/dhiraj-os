"""Findings for "What you might have missed": up to five things the original listing does not reveal.

Every finding is built from structured analysis results and cites evidence that exists in the store;
a candidate whose evidence cannot be resolved is dropped. Wording is templated and neutral: FACT
states what was retrieved, INTERPRETATION says what it might mean without a verdict, ACTION is optional.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date, datetime

from models.company import CompanyProfile
from models.opportunity import OpportunityProfile
from models.report import Finding, FindingKind, HiringSignal, MarketAnalysis, NewsSignal
from services.evidence.store import EvidenceStore
from utils.text import truncate

MAX_FINDINGS = 5
MAX_PER_KIND = 2
MAX_HIRING_FAMILY_FIRST_PASS = 3  # leaves room for news / market / timing findings
STALE_AFTER_DAYS = 45
DEADLINE_WARNING_DAYS = 14
_HIRING_FAMILY = {"volume", "listing", "skills", "experience", "location", "work_mode", "salary"}
_ICON_TITLE: dict[str, tuple[str, str]] = {
    "volume": ("🧭", "Open Roles"),
    "listing": ("✅", "Listing Cross-check"),
    "skills": ("🔎", "Hiring Pattern"),
    "experience": ("⚖️", "Experience Requirements"),
    "location": ("📍", "Location"),
    "work_mode": ("🏠", "Work Arrangement"),
    "salary": ("💰", "Compensation Signal"),
    "news": ("📰", "Recent News"),
    "funding": ("🏦", "Funding Coverage"),
    "market": ("📈", "Market Demand"),
    "freshness": ("⏳", "Listing Age"),
    "deadline": ("🗓️", "Application Deadline"),
}
_SOURCE_LABELS = {
    "job": ("job listing", "job listings"),
    "news": ("news article", "news articles"),
    "company_site": ("company site page", "company site pages"),
    "web": ("web result", "web results"),
    "knowledge_graph": ("knowledge panel", "knowledge panels"),
}
_DATE_FORMATS = ("%Y-%m-%d", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y", "%d-%b-%Y", "%d %B, %Y")
_ORDINAL = re.compile(r"(?<=\d)(?:st|nd|rd|th)\b", re.I)


def parse_listing_date(text: str | None) -> date | None:
    """Parse an unambiguous absolute date. Numeric d/m/y forms are refused: 03/04/2026 could be either."""
    if not text:
        return None
    cleaned = _ORDINAL.sub("", text.strip().replace("Sept", "Sep"))
    cleaned = cleaned[:10] if re.match(r"\d{4}-\d{2}-\d{2}", cleaned) else cleaned
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def summarize_sources(ids: list[str], store: EvidenceStore) -> str:
    counts: Counter[str] = Counter(item.source_type for i in ids if (item := store.get(i)))
    parts = [
        f"{n} {_SOURCE_LABELS[kind][0 if n == 1 else 1]}" for kind, n in counts.most_common()
    ]
    return "Sources: " + ", ".join(parts) if parts else "Sources: none"


def _finding(kind: FindingKind, fact: str, interpretation: str, ids: list[str], store: EvidenceStore,
             *, action: str | None = None, strength: float = 0.5, title: str | None = None) -> Finding | None:
    valid = store.existing_ids(dict.fromkeys(ids))
    if not valid:
        return None  # NO SOURCE = NO FACT
    icon, default_title = _ICON_TITLE[kind]
    return Finding(
        kind=kind, icon=icon, title=title or default_title, fact=fact, interpretation=interpretation, action=action,
        evidence_ids=valid, sources_summary=summarize_sources(valid, store), strength=round(strength, 3),
    )


# ------------------------------------------------------------------- candidates

def _from_hiring(hiring: HiringSignal | None, store: EvidenceStore) -> list[Finding]:
    out = []
    for c in hiring.comparisons if hiring else []:
        f = _finding(c.kind, c.fact, c.interpretation, c.evidence_ids, store, action=c.action, strength=c.strength)
        if f:
            out.append(f)
    return out


def _from_news(news: NewsSignal | None, store: EvidenceStore) -> list[Finding]:
    if not news:
        return []
    item = next((n for n in news.items if n.relevance in ("high", "medium")), None)
    if not item:
        return []
    when = f" · {item.date_text}" if item.date_text else ""
    source = f"{item.publisher}{when}: " if item.publisher else ""
    strength = 0.5 + (0.3 if item.relevance == "high" else 0.1)
    f = _finding(
        "news", f"{source}“{item.title}”", item.relevance_reason, [item.evidence_id], store,
        action="Read the article for context that may relate to this role.", strength=strength,
    )
    return [f] if f else []


def _from_funding(company: CompanyProfile | None, store: EvidenceStore) -> list[Finding]:
    if not company or not company.funding:
        return []
    fact = company.funding[0]
    f = _finding(
        "funding", f"Coverage found: “{truncate(fact.text, 200)}”",
        "This is reported by the cited source; ScoutLens has not independently verified it.",
        fact.evidence_ids, store, strength=0.45,
    )
    return [f] if f else []


def _from_market(market: MarketAnalysis | None, resume_supplied: bool, store: EvidenceStore) -> list[Finding]:
    if not market or not market.signals or market.sample_size == 0:
        return []
    if resume_supplied:
        gaps = [s for s in market.signals if s.missing_from_resume and s.percent >= 30]
        pick = max(gaps, key=lambda s: s.percent, default=None)
    else:
        adjacent = [s for s in market.signals if s.scope == "adjacent" and s.percent >= 30]
        pick = max(adjacent, key=lambda s: s.percent, default=None)
    if not pick:
        return []
    fact = pick.statement
    if pick.scope == "adjacent":
        fact += " It is not mentioned in this listing."
    f = _finding("market", fact, pick.interpretation, pick.evidence_ids, store, action=pick.action, strength=0.6 + 0.3 * pick.percent / 100)
    return [f] if f else []


def _from_timing(opp: OpportunityProfile, listing_evidence_id: str | None, today: date, store: EvidenceStore) -> list[Finding]:
    if not listing_evidence_id:
        return []
    out: list[Finding | None] = []
    deadline = parse_listing_date(opp.application_deadline)
    if deadline is not None:
        days = (deadline - today).days
        if days < 0:
            out.append(_finding(
                "deadline",
                f"The listing states an application deadline of {opp.application_deadline}, which is {-days} day(s) "
                f"before this investigation ({today.isoformat()}).",
                "The listing may no longer be accepting applications, or the date on the page may be outdated.",
                [listing_evidence_id], store, action="Confirm the deadline on the company's careers page.", strength=0.8,
            ))
        elif days <= DEADLINE_WARNING_DAYS:
            out.append(_finding(
                "deadline",
                f"The listing states an application deadline of {opp.application_deadline}, {days} day(s) after this investigation.",
                "The time left may affect how much preparation is possible.",
                [listing_evidence_id], store, action="Plan your application around this date.", strength=0.7,
            ))
    posted = parse_listing_date(opp.date_posted)
    if posted is not None and (today - posted).days >= STALE_AFTER_DAYS:
        age = (today - posted).days
        out.append(_finding(
            "freshness",
            f"The listing was posted on {opp.date_posted} ({age} days before this investigation).",
            "Older listings may already be filled or may remain open; the listing's status is worth verifying.",
            [listing_evidence_id], store, action="Confirm the role is still open.", strength=0.5,
        ))
    return [f for f in out if f]


# -------------------------------------------------------------------- selection

def select_findings(candidates: list[Finding]) -> list[Finding]:
    """Strongest first, but varied: at most 2 per kind, and hiring-pattern cards leave room for other evidence."""
    ranked = sorted(candidates, key=lambda f: -f.strength)
    chosen: list[Finding] = []
    per_kind: Counter[str] = Counter()
    hiring_count = 0

    def take(finding: Finding, *, enforce_family: bool) -> bool:
        nonlocal hiring_count
        if per_kind[finding.kind] >= MAX_PER_KIND:
            return False
        in_family = finding.kind in _HIRING_FAMILY
        if enforce_family and in_family and hiring_count >= MAX_HIRING_FAMILY_FIRST_PASS:
            return False
        chosen.append(finding)
        per_kind[finding.kind] += 1
        hiring_count += in_family
        return True

    for finding in ranked:
        if len(chosen) < MAX_FINDINGS:
            take(finding, enforce_family=True)
    for finding in ranked:
        if len(chosen) < MAX_FINDINGS and finding not in chosen:
            take(finding, enforce_family=False)
    return sorted(chosen, key=lambda f: -f.strength)


def build_findings(
    opp: OpportunityProfile,
    company: CompanyProfile | None,
    hiring: HiringSignal | None,
    news: NewsSignal | None,
    market: MarketAnalysis | None,
    store: EvidenceStore,
    *,
    resume_supplied: bool = False,
    listing_evidence_id: str | None = None,
    today: date | None = None,
) -> list[Finding]:
    today = today or date.today()
    candidates = [
        *_from_hiring(hiring, store),
        *_from_news(news, store),
        *_from_funding(company, store),
        *_from_market(market, resume_supplied, store),
        *_from_timing(opp, listing_evidence_id, today, store),
    ]
    return select_findings(candidates)
