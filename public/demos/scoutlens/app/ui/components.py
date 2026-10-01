"""HTML builders for report sections. Pure functions (string in, string out) so they can be tested
without a browser. Every dynamic value is escaped by the helpers in :mod:`ui.styles`."""
from __future__ import annotations

import re

from agents.report_agent import format_display_time
from models.evidence import EvidenceItem
from models.report import CrossCheck, Finding, Indicator, NewsHighlight, SignalComparison, SkillFrequency
from models.resume import SkillMatch
from models.search import SearchRecord
from ui.styles import badge, bar, card, chips, esc, kv_grid, label, link, tier_badge

_CONFIDENCE_KIND = {"high": "ok", "medium": "info", "low": "muted"}
_FIT = {
    "matched": ("✓", "Matched"),
    "partial": ("△", "Partial"),
    "not_found": ("✗", "Not found in resume"),
    "unknown": ("?", "Unknown"),
}
_CHECK_KIND = {"corroborated": ("ok", "Corroborated"), "single_source": ("warn", "Single source"),
               "conflicting": ("warn", "Conflicting information"), "insufficient": ("muted", "Insufficient evidence")}
_STEP_ICON = {"done": "✓", "running": "●", "pending": "○", "failed": "!", "skipped": "–"}


_CITATION = re.compile(r"\[(E\d+)\]")


def cited_text(text: str, by_id: dict[str, EvidenceItem]) -> str:
    """Escape ``text`` and turn ``[E3]`` markers into links to the real source (unknown ids stay plain)."""
    out, last = [], 0
    for match in _CITATION.finditer(text):
        out.append(esc(text[last : match.start()]))
        item = by_id.get(match.group(1))
        out.append(f'<sup>{link(match.group(1), item.source_url)}</sup>' if item else esc(match.group(0)))
        last = match.end()
    out.append(esc(text[last:]))
    return "".join(out)


def notice(text: str, kind: str = "") -> str:
    cls = {"warn": " sl-warnbox", "gap": " sl-gap"}.get(kind, "")
    return f'<div class="sl-notice{cls}">{esc(text)}</div>'


def demo_banner(text: str) -> str:
    return f'<div class="sl-demo">🧪 {esc(text)}</div>'


# ------------------------------------------------------------------- evidence

def evidence_refs(ids: list[str], by_id: dict[str, EvidenceItem], limit: int = 8) -> str:
    """Compact ``E3`` chips, each linking to its real source."""
    shown = [by_id[i] for i in ids if i in by_id][:limit]
    parts = [link(e.id, e.source_url) for e in shown]
    more = len(ids) - len(shown)
    tail = f' <span class="sl-muted">+{more} more</span>' if more > 0 else ""
    return " ".join(parts) + tail


def evidence_card(e: EvidenceItem) -> str:
    when = e.date or ""
    meta = " · ".join(x for x in (e.publisher, when, f"retrieved {e.retrieved_at:%Y-%m-%d %H:%M} UTC") if x)
    return (
        '<div class="sl-ev"><div class="sl-ev-h">'
        f'{badge(e.id, "accent")}{tier_badge(e.tier, e.tier_label)}{badge(e.source_type.replace("_", " "), "muted")}'
        f'{link(e.source_title, e.source_url)}</div>'
        f'<div class="sl-ev-meta">{esc(e.tier_label)} · confidence {esc(e.confidence)} · relevance {esc(e.relevance)}'
        f'{" · " + esc(meta) if meta else ""}</div>'
        f'<div class="sl-ev-meta"><b>Claim:</b> {esc(e.claim)}</div>'
        f'<div class="sl-ev-x">{esc(e.evidence_text)}</div></div>'
    )


# ------------------------------------------------------------------- findings

def finding_card(f: Finding, by_id: dict[str, EvidenceItem]) -> str:
    action = f'{label("User action")}<div class="sl-action">{esc(f.action)}</div>' if f.action else ""
    return (
        f'<div class="sl-finding"><div class="sl-fhead"><span class="sl-ficon">{esc(f.icon)}</span>{esc(f.title)}</div>'
        f'{label("Fact")}<div class="sl-fact">{esc(f.fact)}</div>'
        f'{label("Interpretation")}<div class="sl-interp">{esc(f.interpretation)}</div>{action}'
        f'<div class="sl-sources">{esc(f.sources_summary)} · {evidence_refs(f.evidence_ids, by_id)}</div></div>'
    )


def comparison_card(c: SignalComparison, by_id: dict[str, EvidenceItem]) -> str:
    action = f'{label("User action")}<div class="sl-action">{esc(c.action)}</div>' if c.action else ""
    refs = f'<div class="sl-sources">{evidence_refs(c.evidence_ids, by_id)}</div>' if c.evidence_ids else ""
    return (
        f'<div class="sl-card sl-tight">{label("Fact")}<div class="sl-fact">{esc(c.fact)}</div>'
        f'{label("Interpretation")}<div class="sl-interp">{esc(c.interpretation)}</div>{action}{refs}</div>'
    )


# ------------------------------------------------------------------- snapshot

def snapshot(opp) -> str:  # noqa: ANN001 - OpportunityProfile
    pairs = [
        ("Company", opp.company_name), ("Role", opp.role_title), ("Location", opp.location),
        ("Experience", opp.experience_required), ("Salary / stipend", opp.salary), ("Job type", opp.job_type),
        ("Work mode", opp.remote_or_onsite), ("Application deadline", opp.application_deadline), ("Posted", opp.date_posted),
    ]
    return kv_grid(pairs)


def skills_block(opp) -> str:  # noqa: ANN001
    parts = []
    if opp.required_skills:
        parts.append(f'{label("Required skills")}{chips(opp.required_skills)}')
    if opp.preferred_skills:
        parts.append(f'{label("Preferred skills")}{chips(opp.preferred_skills, "preferred")}')
    if not parts:
        parts.append(notice("No recognisable skills were found in the listing text.", "gap"))
    return "".join(parts)


def metrics(indicators: list[Indicator]) -> str:
    tiles = "".join(
        f'<div class="sl-metric"><div class="sl-metric-v">{esc(i.value)}</div><div class="sl-metric-k">{esc(i.label)}</div>'
        f'<div class="sl-metric-d">{esc(i.detail)}</div></div>'
        for i in indicators
    )
    return f'<div class="sl-metrics">{tiles}</div>'


# ---------------------------------------------------------------- hiring / news

def skill_bars(freqs: list[SkillFrequency], limit: int = 10) -> str:
    rows = "".join(
        bar(f.skill, f.count, f.total, f.percent, highlight=not f.in_original, note="in this listing" if f.in_original else "")
        for f in freqs[:limit]
    )
    return f'<div class="sl-card">{rows}</div>' if rows else ""


def news_card(n: NewsHighlight) -> str:
    rel_kind = {"high": "ok", "medium": "info", "low": "muted"}[n.relevance]
    meta = " · ".join(x for x in (n.publisher, n.date_text) if x)
    fact = f'{label("Fact")}<div class="sl-interp">{esc(n.summary)}</div>' if n.summary else ""
    return (
        f'<div class="sl-news"><div class="sl-news-t">{link(n.title, n.url)}</div>'
        f'<div class="sl-ev-meta">{tier_badge(n.tier, "Source tier")}{badge(n.topic, "violet")}{badge("relevance: " + n.relevance, rel_kind)} {esc(meta)}</div>'
        f'{fact}{label("Interpretation")}<div class="sl-interp">{esc(n.relevance_reason)}</div></div>'
    )


# -------------------------------------------------------------------------- fit

def fit_row(m: SkillMatch) -> str:
    icon, name = _FIT[m.status]
    lead = "" if m.basis.rstrip(".").lower() == name.lower() else f"<b>{esc(name)}.</b> "  # avoid "Not found in resume. Not found in resume"
    snippet = f'<div class="sl-fit-snip">“{esc(m.resume_evidence[0].snippet)}” ({esc(m.resume_evidence[0].section)})</div>' if m.resume_evidence else ""
    return (
        f'<div class="sl-fit-row sl-fit-{esc(m.status)}"><div class="sl-fit-ic">{icon}</div>'
        f'<div><b>{esc(m.skill)}</b></div><div>{badge(m.requirement, "accent" if m.requirement == "required" else "muted")}</div>'
        f'<div><div class="sl-fit-basis">{lead}{esc(m.basis)}</div>{snippet}</div></div>'
    )


# -------------------------------------------------------------------- method

def search_table(records: list[SearchRecord], tz_name: str) -> str:
    engine_names = {"google": "Google Search", "google_jobs": "Google Jobs", "google_news": "Google News"}
    rows = []
    for r in records:
        source = badge("error", "bad") if r.error else (badge("cache", "muted") if r.from_cache else badge("live", "ok"))
        rows.append(
            f"<tr><td>{esc(r.id)}</td><td>{esc(engine_names.get(r.engine, r.engine))}</td><td>{esc(r.query)}</td>"
            f"<td>{esc(r.purpose)}</td><td>{source}</td><td>{r.result_count}</td>"
            f"<td>{esc(format_display_time(r.fetched_at, tz_name))}</td></tr>"
        )
    head = "<tr><th>#</th><th>API</th><th>Query</th><th>Purpose</th><th>Source</th><th>Results</th><th>Retrieved</th></tr>"
    return f'<table class="sl-table">{head}{"".join(rows)}</table>'


def crosscheck_card(c: CrossCheck, by_id: dict[str, EvidenceItem]) -> str:
    kind, name = _CHECK_KIND[c.status]
    refs = f' · {evidence_refs(c.evidence_ids, by_id, 6)}' if c.evidence_ids else ""
    return card(f'{badge(name, kind)} <b>{esc(c.claim)}</b><div class="sl-interp">{esc(c.detail)}{refs}</div>', "sl-tight")


# ------------------------------------------------------------------- progress

def steps_html(steps: list[tuple[str, str, str, str]]) -> str:
    """``(key, label, status, detail)`` rows -> the live investigation checklist."""
    rows = []
    for _key, text, status, detail in steps:
        detail_html = f'<div class="sl-step-d">{esc(detail)}</div>' if detail else ""
        rows.append(
            f'<div class="sl-step sl-s-{esc(status)}"><div class="sl-step-ic">{_STEP_ICON.get(status, "○")}</div>'
            f'<div><div class="sl-step-t">{esc(text)}</div>{detail_html}</div></div>'
        )
    return f'<div class="sl-steps">{"".join(rows)}</div>'
