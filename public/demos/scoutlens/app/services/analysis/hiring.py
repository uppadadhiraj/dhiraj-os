"""Hiring-signal analysis: compares the original opportunity with the employer's other current listings.

Every number is computed from the listings actually collected; ``sample_size`` is the denominator
and is always reported. Comparisons are neutral observations ("varies", "does not appear"), never
verdicts, and experience is only compared between listings of the same seniority tier.
"""
from __future__ import annotations

import re
from collections import Counter
from urllib.parse import urlparse

from models.opportunity import OpportunityProfile
from models.report import (
    ExperienceObservation,
    HiringSignal,
    LocationCount,
    SignalComparison,
    SkillFrequency,
)
from models.search import JobListing
from services.evidence.store import EvidenceStore
from services.scraping.text_parsers import detect_work_mode, format_experience, parse_experience, parse_salary
from services.serpapi.jobs import dedupe_jobs
from services.skills import extract_skills
from utils.text import company_matches, truncate

MAX_SAMPLE = 25
MIN_SKILL_COUNT = 3  # a skill must appear in at least this many listings to be called out
MIN_SKILL_PERCENT = 30.0
MIN_COMPARABLE_EXPERIENCE = 2
MIN_SAMPLE_FOR_ABSENCE = 5  # "appears in none of N" is only meaningful with a reasonable N
MIN_SAMPLE_FOR_LOCATION = 3
MAX_SKILLS_LISTED = 15
_TOKEN = re.compile(r"[a-z0-9+#]+")
_ROLE_STOPWORDS = {
    "the", "a", "an", "of", "and", "for", "in", "at", "to", "with", "sr", "jr", "senior", "junior", "lead",
    "intern", "internship", "trainee", "associate", "i", "ii", "iii", "remote", "hybrid", "staff", "principal",
}
SIMILAR_ROLE_THRESHOLD = 0.33


# --------------------------------------------------------------------- helpers

def seniority_of(title: str | None) -> str:
    text = (title or "").lower()
    if re.search(r"\b(intern|internship|trainee|apprentice)\b", text):
        return "intern"
    if re.search(r"\b(senior|sr|lead|staff|principal|architect|manager|director|head|vp)\b", text):
        return "senior"
    if re.search(r"\b(junior|jr|associate|entry|graduate|fresher)\b", text):
        return "junior"
    return "mid"


def role_tokens(title: str | None) -> set[str]:
    return {t for t in _TOKEN.findall((title or "").lower()) if len(t) > 1 and t not in _ROLE_STOPWORDS}


def role_similarity(a: str | None, b: str | None) -> float:
    """Jaccard overlap of the meaningful words in two role titles."""
    ta, tb = role_tokens(a), role_tokens(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


def _url_key(url: str | None) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    return f"{parsed.netloc.lower().removeprefix('www.')}{parsed.path.rstrip('/')}"


# The same city under its old/alternative names. Without this, "Bangalore" vs "Bengaluru" produced a false
# "none of the other listings are in your city" finding.
_CITY_ALIASES = {
    "bangalore": "bengaluru", "bengaluru urban": "bengaluru", "bombay": "mumbai", "gurgaon": "gurugram",
    "madras": "chennai", "calcutta": "kolkata", "new delhi": "delhi", "poona": "pune", "cochin": "kochi",
    "trivandrum": "thiruvananthapuram", "baroda": "vadodara", "mysore": "mysuru", "vizag": "visakhapatnam",
}


def city_of(location: str | None) -> str:
    first = (location or "").split(",")[0].strip().lower()
    return _CITY_ALIASES.get(first, first)


def is_same_listing(job: JobListing, opp: OpportunityProfile) -> bool:
    """Whether a Google Jobs result is the very listing the user supplied (by URL, or title + place)."""
    ours = {_url_key(opp.source_url), _url_key(opp.application_url)} - {""}
    theirs = {_url_key(link.url) for link in job.apply_links} | {_url_key(job.share_link)}
    if ours & theirs:
        return True
    # A title match alone is not enough: other employers post the same title. Require the same company.
    if job.company_name and opp.company_name and not company_matches(job.company_name, opp.company_name):
        return False
    if not opp.role_title or _TOKEN.findall(job.title.lower()) != _TOKEN.findall(opp.role_title.lower()):
        return False
    a, b = city_of(job.location), city_of(opp.location)
    return not a or not b or a == b or a in b or b in a


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _cmp(kind, fact, interpretation, evidence_ids, *, action=None, strength=0.5) -> SignalComparison:
    return SignalComparison(
        kind=kind, fact=fact, interpretation=interpretation, action=action,
        evidence_ids=list(dict.fromkeys(evidence_ids)), strength=round(strength, 3),
    )


# -------------------------------------------------------------------- analysis

def analyze_hiring(
    opp: OpportunityProfile,
    listings: list[JobListing],
    store: EvidenceStore,
    *,
    search_ids: list[str] | None = None,
    max_sample: int = MAX_SAMPLE,
    same_region: bool = True,
    search_region: str | None = None,
) -> HiringSignal:
    company = opp.company_name or ""
    unique = dedupe_jobs(listings)
    mine = [j for j in unique if company_matches(j.company_name, company)]
    excluded = len(unique) - len(mine)
    originals = [j for j in mine if is_same_listing(j, opp)]
    related = [j for j in mine if j not in originals][:max_sample]

    evidence_for: dict[int, str] = {}
    for index, job in enumerate(related):
        item = store.add_job(job, f"{company} has a current opening: {job.title}")
        if item:
            evidence_for[index] = item.id
    signal = HiringSignal(
        company=company,
        sample_size=len(related),
        excluded_other_company=excluded,
        original_found=bool(originals),
        original_via=originals[0].via if originals else None,
        titles=list(dict.fromkeys(j.title for j in related))[:10],
        listing_evidence_ids=list(evidence_for.values()),
        search_ids=search_ids or [],
        search_region=search_region,
    )
    if excluded:
        signal.notes.append(f"{_plural(excluded, 'result')} from other employers were excluded from the sample.")
    if not related:
        signal.notes.append("Insufficient evidence: no other current listings from this employer were found.")
        _add_listing_comparison(signal, opp, originals, store, len(unique))
        return signal

    own_skills = set(opp.all_skills)
    signal.skill_frequencies = _skill_frequencies(related, own_skills)
    signal.similar_count = sum(role_similarity(j.title, opp.role_title) >= SIMILAR_ROLE_THRESHOLD for j in related)
    _collect_context(signal, related)
    tier = seniority_of(opp.role_title)
    broad = tier in ("intern", "junior")  # entry-level expectations are similar across departments; senior ones are not
    comparable = [
        (i, j) for i, j in enumerate(related)
        if seniority_of(j.title) == tier and (broad or role_similarity(j.title, opp.role_title) >= SIMILAR_ROLE_THRESHOLD)
    ]
    signal.experience = _experience_observations(comparable, evidence_for)
    signal.notes.append(
        f"Experience is compared only with other '{tier}'-level listings" + ("." if broad else " that have a similar title.")
    )

    comps = signal.comparisons
    comps.append(_volume_comparison(signal, company))
    _add_listing_comparison(signal, opp, originals, store, len(unique))
    comps.extend(_skill_comparisons(signal, opp, related, evidence_for))
    comps.extend(_experience_comparisons(signal, opp, evidence_for))
    if same_region:
        comps.extend(filter(None, [
            _location_comparison(signal, opp, related, evidence_for),
            _work_mode_comparison(signal, opp, related, evidence_for),
            _salary_comparison(signal, opp, related, evidence_for),
        ]))
    else:
        signal.notes.append(
            "Location, work-arrangement and salary comparisons were skipped: the other listings come from a "
            f"different region ({search_region or 'the default region'}) than this listing, so they would not be comparable."
        )
    return signal


def _skill_frequencies(related: list[JobListing], own_skills: set[str]) -> list[SkillFrequency]:
    counts: Counter[str] = Counter()
    for job in related:
        counts.update(set(extract_skills(job.text)))
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:MAX_SKILLS_LISTED]
    return [SkillFrequency(skill=s, count=c, total=len(related), in_original=s in own_skills) for s, c in ranked]


def _collect_context(signal: HiringSignal, related: list[JobListing]) -> None:
    locations = Counter(j.location.strip() for j in related if j.location)
    signal.locations = [LocationCount(location=loc, count=n) for loc, n in locations.most_common(5)]
    modes: Counter[str] = Counter()
    salaries: list[str] = []
    for job in related:
        mode = "remote" if job.work_from_home else detect_work_mode(job.title, job.location, job.description)
        modes[mode or "unspecified"] += 1
        salary = job.salary or parse_salary(job.text)
        if salary and salary != "Unpaid":
            salaries.append(salary)
    signal.work_modes = dict(modes)
    signal.salary_listed_count = len(salaries)
    signal.salary_examples = list(dict.fromkeys(salaries))[:3]


def _experience_observations(comparable: list[tuple[int, JobListing]], evidence_for: dict[int, str]) -> list[ExperienceObservation]:
    observations = []
    for index, job in comparable:
        info = parse_experience(job.text)
        if info:
            observations.append(ExperienceObservation(
                title=job.title, location=job.location, raw=info.raw, min_years=info.min_years,
                max_years=info.max_years, evidence_id=evidence_for.get(index),
            ))
    return observations


# ----------------------------------------------------------------- comparisons

def _volume_comparison(signal: HiringSignal, company: str) -> SignalComparison:
    n = signal.sample_size
    fact = f"Google Jobs returned {_plural(n, 'other current listing')} at {company}; {signal.similar_count} have a title similar to this role."
    return _cmp(
        "volume", fact,
        "This counts the listings Google Jobs returned for the company; it is not a complete list of its openings.",
        signal.listing_evidence_ids, action="Compare similar roles at the company before deciding where to apply.",
        strength=0.4 + 0.3 * min(n, 20) / 20,
    )


def _add_listing_comparison(signal: HiringSignal, opp: OpportunityProfile, originals: list[JobListing], store: EvidenceStore, total_results: int) -> None:
    if originals:
        job = originals[0]
        item = store.add_job(job, f"The supplied listing also appears in Google Jobs: {job.title}")
        via = f" (via {job.via})" if job.via else ""
        signal.comparisons.append(_cmp(
            "listing", f"This listing also appears in Google Jobs{via}.",
            "An independent index carries the same posting, which corroborates that it is publicly listed.",
            [item.id] if item else [], strength=0.35,
        ))
    elif total_results:
        signal.comparisons.append(_cmp(
            "listing",
            f"This listing was not among the {_plural(total_results, 'result')} Google Jobs returned for the company.",
            "This may only reflect search coverage; it does not show the listing is inactive or inaccurate.",
            signal.listing_evidence_ids[:3], action="Verify the listing's status on the company's own careers page.", strength=0.3,
        ))


def _skill_comparisons(signal: HiringSignal, opp: OpportunityProfile, related: list[JobListing], evidence_for: dict[int, str]) -> list[SignalComparison]:
    out: list[SignalComparison] = []
    own = set(opp.all_skills)
    gaps = [f for f in signal.skill_frequencies if f.skill not in own and f.count >= MIN_SKILL_COUNT and f.percent >= MIN_SKILL_PERCENT]
    for freq in gaps[:3]:
        ids = [evidence_for[i] for i, j in enumerate(related) if i in evidence_for and freq.skill in extract_skills(j.text)]
        out.append(_cmp(
            "skills",
            f"{freq.skill} appears in {freq.count} of {freq.total} sampled current listings from {signal.company} "
            f"({freq.percent:g}%) but is not mentioned in this listing.",
            "Skills used across the company's other roles may also matter for this team; the listing itself does not say.",
            ids, action=f"Check whether {freq.skill} is used on this team.", strength=0.55 + 0.4 * freq.percent / 100,
        ))
    if signal.sample_size >= MIN_SAMPLE_FOR_ABSENCE:
        present = {f.skill for f in signal.skill_frequencies}
        unique = [s for s in opp.required_skills if s not in present]
        for skill in unique[:2]:
            out.append(_cmp(
                "skills",
                f"{skill} is required in this listing but appears in none of the {signal.sample_size} other sampled listings.",
                "Requirements differ between roles; this may simply reflect this team's stack.",
                signal.listing_evidence_ids[:5], strength=0.4,
            ))
    return out


def _range(min_years: float | None, max_years: float | None) -> tuple[float | None, float | None]:
    return (min_years, max_years)


def _experience_comparisons(signal: HiringSignal, opp: OpportunityProfile, evidence_for: dict[int, str]) -> list[SignalComparison]:
    if opp.experience_min_years is None:
        return []
    observed = signal.experience
    if len(observed) < MIN_COMPARABLE_EXPERIENCE:
        signal.notes.append(
            "Insufficient evidence: fewer than 2 comparable listings state an experience requirement, so no comparison was made."
        )
        return []
    original = _range(opp.experience_min_years, opp.experience_max_years)
    original_text = format_experience(*original)
    different = [o for o in observed if _range(o.min_years, o.max_years) != original]
    ids = [o.evidence_id for o in observed if o.evidence_id]
    if not different:
        return [_cmp(
            "experience",
            f"All {len(observed)} comparable listings that state experience ask for the same as this one ({original_text}).",
            "The experience requirement looks consistent across the company's comparable listings.",
            ids, strength=0.3,
        )]
    tally = Counter(format_experience(o.min_years, o.max_years) for o in different)
    others = ", ".join(f"{text} ({_plural(n, 'listing')})" for text, n in tally.most_common())
    return [_cmp(
        "experience",
        f"This listing states {original_text}. Among {len(observed)} comparable listings that state experience, "
        f"{len(different)} state something different: {others}.",
        "Experience requirements vary across current listings. This does not establish that the original listing "
        "is inaccurate, but it is a useful signal to verify.",
        ids, action="Verify the experience expectation with the employer.",
        strength=0.7 + (0.2 if len(different) / len(observed) >= 0.5 else 0.0),
    )]


def _location_comparison(signal: HiringSignal, opp: OpportunityProfile, related: list[JobListing], evidence_for: dict[int, str]) -> SignalComparison | None:
    city = city_of(opp.location)
    if not city or opp.remote_or_onsite == "remote" or signal.sample_size < MIN_SAMPLE_FOR_LOCATION or not signal.locations:
        return None
    cities = Counter(city_of(j.location) for j in related if j.location)
    if not cities or any(city in c or c in city for c in cities if c):
        return None
    top, count = cities.most_common(1)[0]
    ids = [evidence_for[i] for i, j in enumerate(related) if i in evidence_for and city_of(j.location) == top]
    return _cmp(
        "location",
        f"This listing is located in {opp.location}; none of the {signal.sample_size} other sampled listings are there. "
        f"{count} are in {top.title()}.",
        "Openings in other locations may have different requirements or work arrangements.",
        ids, strength=0.5,
    )


def _work_mode_comparison(signal: HiringSignal, opp: OpportunityProfile, related: list[JobListing], evidence_for: dict[int, str]) -> SignalComparison | None:
    remote = signal.work_modes.get("remote", 0)
    if opp.remote_or_onsite in (None, "remote") or remote < MIN_SKILL_COUNT:
        return None
    ids = [evidence_for[i] for i, j in enumerate(related) if i in evidence_for and (j.work_from_home or detect_work_mode(j.title, j.location, j.description) == "remote")]
    return _cmp(
        "work_mode",
        f"This listing is {opp.remote_or_onsite}; {remote} of {signal.sample_size} other sampled listings state remote work.",
        "Work arrangements may differ across teams at the same company.",
        ids, action="Confirm the work arrangement for this role.", strength=0.5,
    )


def _salary_comparison(signal: HiringSignal, opp: OpportunityProfile, related: list[JobListing], evidence_for: dict[int, str]) -> SignalComparison | None:
    if opp.salary or signal.salary_listed_count < 2:
        return None
    ids = [evidence_for[i] for i, j in enumerate(related) if i in evidence_for and (j.salary or parse_salary(j.text))]
    examples = "; ".join(truncate(s, 40) for s in signal.salary_examples)
    return _cmp(
        "salary",
        f"This listing does not state a salary; {signal.salary_listed_count} of {signal.sample_size} other sampled listings do (for example: {examples}).",
        "Compensation stated in other listings is a reference point, not a statement about this role.",
        ids, action="Ask about the compensation range for this role.", strength=0.6,
    )
