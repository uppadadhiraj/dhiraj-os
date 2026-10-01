"""Market skill analysis: how often skills appear across a role-level sample of current listings.

The sample comes from a search on the *role title only*, so a skill's percentage is not inflated by
having searched for that skill. Percentages use the real, deduplicated sample size as denominator,
and the method is always stated: this is what Google Jobs returned, not a random sample of the market.
"""
from __future__ import annotations

from collections import Counter

from models.opportunity import OpportunityProfile
from models.report import MarketAnalysis, MarketSignal
from models.resume import ResumeProfile
from models.search import JobListing
from services.analysis.hiring import is_same_listing, role_similarity
from services.evidence.store import EvidenceStore
from services.resume.matching import match_single
from services.serpapi.jobs import dedupe_jobs
from services.skills import extract_skills

MIN_RELIABLE_SAMPLE = 10
FREQUENT_PERCENT = 30.0
MINORITY_PERCENT = 10.0
ADJACENT_MIN_PERCENT = 20.0
MAX_ADJACENT = 3
MAX_SIGNALS = 10
MAX_EVIDENCE_LISTINGS = 40
MAX_IDS_PER_SIGNAL = 12


def interpret(skill: str, percent: float, resume_status: str | None) -> tuple[str, str | None]:
    """Neutral interpretation (and optional action) for a skill's share of the sample."""
    if percent >= FREQUENT_PERCENT and resume_status == "matched":
        text = f"{skill} appears frequently in the sampled listings, and it is on your resume."
    elif percent >= FREQUENT_PERCENT:
        text = f"{skill} appears frequently enough in the sampled listings to consider it a useful preparation area."
    elif percent >= MINORITY_PERCENT:
        text = f"{skill} appears in a minority of the sampled listings."
    else:
        text = f"{skill} appears in few of the sampled listings."
    action = None
    if resume_status == "not_found":
        text += " It was not found on your resume."
    elif resume_status == "partial":
        text += " Only a related skill or a passing mention was found on your resume."
    if resume_status in ("not_found", "partial") and percent >= FREQUENT_PERCENT:
        action = f"Review {skill} fundamentals if this fits your goals."
    return text, action


def _resume_status(skill: str, resume: ResumeProfile | None) -> str | None:
    return None if resume is None else match_single(skill, resume).status


def analyze_market(
    opp: OpportunityProfile,
    listings: list[JobListing],
    store: EvidenceStore,
    *,
    role_query: str,
    location: str | None,
    resume: ResumeProfile | None = None,
    search_ids: list[str] | None = None,
) -> MarketAnalysis:
    unique = dedupe_jobs(listings)
    on_role = [j for j in unique if not is_same_listing(j, opp) and role_similarity(j.title, role_query) > 0]
    excluded = len([j for j in unique if not is_same_listing(j, opp)]) - len(on_role)
    analysis = MarketAnalysis(
        role_query=role_query, location=location, sample_size=len(on_role), excluded_off_role=excluded,
        low_sample=len(on_role) < MIN_RELIABLE_SAMPLE, search_ids=search_ids or [],
        method=(
            f"{len(on_role)} unique listings returned by Google Jobs for '{role_query}'"
            f"{f' in {location}' if location else ''}, excluding this listing. "
            "This is what Google returned, not a random sample of the whole market. "
            "The search used the role title only, so skill percentages are not inflated by the query."
        ),
    )
    if not on_role:
        analysis.notes.append("Insufficient evidence: no comparable listings were found for this role.")
        return analysis
    if analysis.low_sample:
        analysis.notes.append(
            f"Small sample ({len(on_role)} listings): treat these percentages as rough indications."
        )
    if excluded:
        analysis.notes.append(f"{excluded} result(s) with unrelated titles were excluded from the sample.")

    skills_per_job = [set(extract_skills(j.text)) for j in on_role]
    counts: Counter[str] = Counter(s for skills in skills_per_job for s in skills)

    named = list(dict.fromkeys([*opp.required_skills, *opp.preferred_skills]))
    adjacent = [
        s for s, c in counts.most_common()
        if s not in named and 100 * c / len(on_role) >= ADJACENT_MIN_PERCENT
    ][:MAX_ADJACENT]
    plan = [(s, "in_listing") for s in named] + [(s, "adjacent") for s in adjacent]

    evidence_for: dict[int, str] = {}
    for index, (job, skills) in enumerate(zip(on_role, skills_per_job)):
        if len(evidence_for) >= MAX_EVIDENCE_LISTINGS:
            break
        if any(s in skills for s, _scope in plan):
            item = store.add_job(job, f"Sampled market listing for '{role_query}'")
            if item:
                evidence_for[index] = item.id

    for skill, scope in plan[:MAX_SIGNALS]:
        count = counts.get(skill, 0)
        percent = round(100 * count / len(on_role), 1)
        status = _resume_status(skill, resume)
        interpretation, action = interpret(skill, percent, status)
        ids = [evidence_for[i] for i, skills in enumerate(skills_per_job) if skill in skills and i in evidence_for]
        analysis.signals.append(MarketSignal(
            skill=skill, count=count, total=len(on_role), scope=scope,  # type: ignore[arg-type]
            resume_status=status,  # type: ignore[arg-type]
            missing_from_resume=None if status in (None, "unknown") else status != "matched",
            statement=f"{count} of {len(on_role)} sampled listings mention {skill} ({percent:g}%).",
            interpretation=interpretation, action=action, evidence_ids=ids[:MAX_IDS_PER_SIGNAL],
        ))
    analysis.signals.sort(key=lambda s: (s.missing_from_resume is not True, -s.percent, s.skill))
    return analysis
