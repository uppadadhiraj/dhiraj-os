"""News analysis: keep only coverage that is about the company and recent, tag it neutrally, rank it.

FACT is always the source's own headline/snippet. Topic and relevance are our interpretation and use
neutral wording. Relative dates ("3 days ago") stay as text; they are used only to order results and
apply the recency window, never converted into calendar dates.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from models.opportunity import OpportunityProfile
from models.report import NewsHighlight, NewsSignal
from models.search import NewsItem
from services.analysis.hiring import role_tokens
from services.evidence.store import EvidenceStore
from utils.text import brand_alias, mentions_company, normalize_company, truncate

RECENCY_WINDOW_DAYS = 365
MAX_LOW_RELEVANCE_ITEMS = 2  # consumer brands attract lots of unrelated coverage; show only a couple of low-relevance items
_SUMMARY_CHARS = 240
_RELATIVE_AGE = re.compile(r"(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago", re.I)
_UNIT_DAYS = {"minute": 0, "hour": 0, "day": 1, "week": 7, "month": 30, "year": 365}
_RELEVANCE_RANK = {"high": 0, "medium": 1, "low": 2}

# (topic label, pattern). First match wins, so order goes from most to least specific.
_TOPICS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (label, re.compile(pattern, re.I))
    for label, pattern in (
        ("Workforce changes", r"\blay ?offs?\b|job cuts|restructur|downsiz|retrench"),
        ("Legal & regulatory", r"\blawsuit|\bsued\b|\bcourt\b|regulator|investigation|\bfined\b|penalt|\bprobe\b"),
        # a concrete round or amount outranks the stock topic ("raises $30M in Series C" vs "UBS raises target price")
        ("Funding & investment", r"\bseries [a-f]\b|\bseed round\b|\bpre-seed\b|\bfunding round\b|\b(?:raises?|raised|secures?|bags?) (?:[$₹€£]|rs\.?\s?)\s?\d"),
        ("Stock & analyst coverage", r"\bshares?\b|\bstock\b|\btarget (?:price|to)\b|\bnifty\b|\bsensex\b|\banalysts?\b|\bupgrades?\b|\bdowngrades?\b|earnings|dividend|market cap"),
        ("Funding & investment", r"\bfunding\b|\braises?\b|\braised\b|series [a-f]\b|seed round|investors?\b|valuation|\bipo\b|acqui(?:red|sition|res)"),
        ("Product & launches", r"\blaunch|unveil|introduc|new product|\breleases?\b|rolls? out|debut"),
        ("Partnerships", r"partner|collaborat|tie-?up|alliance|joins? forces"),
        ("Expansion & hiring", r"expan|\bhir(?:e|es|ing)\b|new office|\bopens?\b[^.]{0,40}\b(?:office|centre|center|campus)\b|headcount|recruit"),
        ("Leadership", r"appoint|names? (?:a )?new|\bceo\b|\bcto\b|\bcfo\b|\bchief\b|steps? down|resign"),
    )
)
_NO_TOPIC = "General coverage"


def approx_age_days(text: str | None) -> int | None:
    """Rough age from Google's relative wording, used only for ordering and the recency window."""
    if not text:
        return None
    match = _RELATIVE_AGE.search(text)
    if not match:
        return None
    return int(match.group(1)) * _UNIT_DAYS[match.group(2).lower()]


def _is_subject(title: str, company: str) -> bool:
    """Whether the headline starts with the company's name (or its brand alias)."""
    head = " ".join(re.sub(r"[^a-z0-9 ]", " ", title.lower()).split())
    names = [n for n in (normalize_company(company), brand_alias(company)) if n]
    return any(head == n or head.startswith(n + " ") for n in names)


def item_age_days(item: NewsItem, now: datetime) -> int | None:
    if item.published_at:
        return max(0, (now - item.published_at).days)
    return approx_age_days(item.date_text)


def classify_topic(text: str) -> str:
    return next((label for label, pattern in _TOPICS if pattern.search(text)), _NO_TOPIC)


def role_terms(opp: OpportunityProfile) -> set[str]:
    """Words tying a news item to this role. Names of 1-2 characters ("Go", "R", "C") are excluded:
    they would match ordinary English words and make unrelated news look relevant."""
    return {t for t in role_tokens(opp.role_title) | {s.lower() for s in opp.all_skills} if len(t) > 2}


def _relevance(topic: str, text: str, terms: set[str]) -> tuple[str, str]:
    lowered = text.lower()
    hit = next((t for t in sorted(terms) if re.search(rf"(?<![a-z0-9]){re.escape(t)}s?(?![a-z0-9])", lowered)), None)
    if hit:
        return "high", f"Mentions '{hit}', which appears in this role's title or requirements."
    if topic == "Stock & analyst coverage":
        return "low", "Stock-market coverage; no clear link to this role."
    if topic != _NO_TOPIC:
        return "medium", f"Company-level coverage on the topic: {topic.lower()}."
    return "low", "General coverage of the company with no clear link to this role."


def analyze_news(
    opp: OpportunityProfile,
    items: list[NewsItem],
    store: EvidenceStore,
    *,
    search_ids: list[str] | None = None,
    max_items: int = 8,
    now: datetime | None = None,
) -> tuple[NewsSignal, list[NewsItem]]:
    """Returns the signal plus the relevant raw items (used e.g. to look for funding mentions)."""
    now = now or datetime.now(timezone.utc)
    company = opp.company_name or ""
    terms = role_terms(opp)
    signal = NewsSignal(company=company, total_found=len(items), search_ids=search_ids or [])

    seen: set[str] = set()
    relevant: list[tuple[NewsItem, int | None]] = []
    for item in items:
        key = item.url.split("?")[0].rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        if not (mentions_company(item.title, company) or mentions_company(item.snippet, company)):
            signal.excluded_irrelevant += 1
            continue
        age = item_age_days(item, now)
        if age is not None and age > RECENCY_WINDOW_DAYS:
            signal.excluded_old += 1
            continue
        relevant.append((item, age))

    enriched = []
    for item, age in relevant:
        text = f"{item.title}. {item.snippet}"
        topic = classify_topic(text)
        level, reason = _relevance(topic, text, terms)
        enriched.append((item, age, topic, level, reason))
    # high relevance first, then most recent; items with unknown age go last within their level
    # Within a relevance level: headlines about the company itself ("Spotify to launch...") before headlines that
    # merely mention it ("Universal Music appoints a former Spotify engineer"), then most recent first.
    enriched.sort(key=lambda e: (_RELEVANCE_RANK[e[3]], not _is_subject(e[0].title, company), e[1] is None, e[1] if e[1] is not None else 0))

    strong = [e for e in enriched if e[3] != "low"]
    weak = [e for e in enriched if e[3] == "low"]
    shown = [*strong, *weak[:MAX_LOW_RELEVANCE_ITEMS]][:max_items]
    hidden = len(enriched) - len(shown)
    for item, _age, topic, level, reason in shown:
        evidence = store.add_news(item, f"Recent news coverage of {company}: {truncate(item.title, 90)}")
        signal.items.append(NewsHighlight(
            title=item.title, url=item.url, publisher=item.publisher, date_text=item.date_text,
            published_at=item.published_at, summary=truncate(item.snippet, _SUMMARY_CHARS),  # empty when Google gives no snippet
            topic=topic, relevance=level, relevance_reason=reason,  # type: ignore[arg-type]
            evidence_id=evidence.id, tier=evidence.tier,
        ))
    if not signal.items:
        signal.notes.append("Insufficient evidence: no recent news items mentioning the company were found.")
    if hidden > 0:
        signal.notes.append(f"{hidden} further low-relevance result(s) were not shown.")
    if signal.excluded_irrelevant:
        signal.notes.append(f"{signal.excluded_irrelevant} result(s) that did not mention the company were excluded.")
    if signal.excluded_old:
        signal.notes.append(f"{signal.excluded_old} result(s) older than {RECENCY_WINDOW_DAYS} days were excluded.")
    return signal, [item for item, *_rest in enriched]
