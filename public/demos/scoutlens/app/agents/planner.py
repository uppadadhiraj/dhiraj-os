"""Investigation planner: decides which live searches are worth their SerpApi credit.

Round 1 is built from the opportunity itself. After those searches run, :meth:`follow_ups` inspects
what was actually found and adds targeted searches only where evidence has a gap ("search again when
evidence is insufficient"). An optional LLM may suggest up to two more queries; they are validated and
capped so the model can never inflate cost or steer searches away from the company.
"""
from __future__ import annotations

import logging
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from config import Settings
from models.opportunity import OpportunityProfile
from models.plan import InvestigationPlan, PlannedSearch, PlanState
from models.preferences import UserPreferences
from models.search import SearchQuery
from services.llm.base import LLMProvider
from utils.errors import ScoutLensError
from utils.text import normalize_company

logger = logging.getLogger(__name__)

ESTABLISHED_BEFORE_YEAR = 2008  # companies older than this are assumed not to need a funding search
_ROLE_TAIL = re.compile(r"\s+[-–—|]\s+.*$|\s*\(.*$|,.*$")
_MAX_LLM_EXTRAS = 2


_REMOTE_PLACES = {"remote", "anywhere", "hybrid", "worldwide", "global"}


def search_location(opp: OpportunityProfile, prefs: UserPreferences) -> str | None:
    """Where to run job searches: the user's preference, else the listing's own (first) location.

    A hardcoded country would compare a Stockholm role with Mumbai listings. ``None`` falls back to the
    configured default. Remote/anywhere carries no place to search from.
    """
    if prefs.location and prefs.location.strip():
        return prefs.location.strip()
    first = (opp.location or "").split(";")[0].strip()
    return None if not first or first.lower() in _REMOTE_PLACES else first


def simplify_role(role: str) -> str:
    """"Software Engineer Intern (Backend) - Bengaluru" -> "Software Engineer Intern"."""
    return _ROLE_TAIL.sub("", role).strip()


class _ExtraQuery(BaseModel):
    engine: Literal["google", "google_news"]
    q: str = Field(min_length=3, max_length=120)
    reason: str = Field(default="", max_length=200)


class _ExtraQueries(BaseModel):
    # No max_length: an over-eager model reply is accepted and capped in code, not rejected wholesale.
    queries: list[_ExtraQuery] = Field(default_factory=list)


class InvestigationPlanner:
    def __init__(self, settings: Settings, llm: LLMProvider | None = None) -> None:
        self._settings = settings
        self._llm = llm

    # ---------------------------------------------------------------- round 1

    def initial_plan(self, opp: OpportunityProfile, prefs: UserPreferences | None = None) -> InvestigationPlan:
        company = (opp.company_name or "").strip()
        if not company:
            raise ValueError("planner requires a company name")
        prefs = prefs or UserPreferences()
        role = simplify_role(opp.role_title) if opp.role_title else None
        market_role = simplify_role(prefs.target_role) if prefs.target_role else role
        where = search_location(opp, prefs)
        plan = InvestigationPlan()

        # "<name> company" rather than the bare name: for consumer brands a bare-name query returns songs,
        # login pages and playlists, while adding "company" brings back the knowledge panel and corporate pages.
        plan.searches.append(PlannedSearch(
            key="identity",
            query=SearchQuery(engine="google", q=f"{company} company", num=10, purpose="Identify the organization"),
            reason="Establish who the employer is: official website, knowledge panel, industry.",
        ))
        plan.searches.append(PlannedSearch(
            key="jobs_company",
            query=SearchQuery(
                engine="google_jobs", q=f"{company} jobs", location=where, pages=self._settings.company_job_pages,
                purpose="Find current openings at the same company",
            ),
            reason="Hiring signals need the employer's other current listings.",
        ))
        if role:
            plan.searches.append(PlannedSearch(
                key="jobs_role",
                query=SearchQuery(
                    engine="google_jobs", q=f"{role} {company}", location=where, pages=1,
                    purpose="Find similar roles at the company and cross-check this listing",
                ),
                reason="Similar roles give a fairer comparison than all openings, and may include this listing.",
            ))
        plan.searches.append(PlannedSearch(
            key="news",
            query=SearchQuery(engine="google_news", q=f"{company} company", purpose="Recent news about the company"),
            reason="Recent coverage can show launches, funding or changes relevant to the role.",
        ))
        if market_role:
            plan.searches.append(PlannedSearch(
                key="market",
                query=SearchQuery(
                    engine="google_jobs", q=market_role, location=where,
                    pages=self._settings.market_pages, purpose=f"Sample the market for '{market_role}'",
                ),
                reason="A role-level sample (not skill-specific) keeps skill demand percentages unbiased.",
            ))
        plan.notes.append(
            "Market sample searches the role title only, so skill percentages are not inflated by the query."
        )
        self._add_llm_extras(plan, opp)
        return plan

    # -------------------------------------------------------------- follow-ups

    def follow_ups(
        self,
        opp: OpportunityProfile,
        state: PlanState,
        executed: set[tuple[str, str]],
    ) -> tuple[list[PlannedSearch], list[str]]:
        """Targeted searches for evidence gaps, plus notes explaining searches deliberately skipped."""
        company = (opp.company_name or "").strip()
        role = simplify_role(opp.role_title) if opp.role_title else None
        candidates: list[PlannedSearch] = []
        notes: list[str] = []

        if not state.official_domain_found:
            candidates.append(PlannedSearch(
                key="official_site",
                query=SearchQuery(engine="google", q=f"{company} official website", num=5,
                                  purpose="Find the official website (not identified in the first search)"),
                reason="No official website could be established from the first search.",
            ))
        if not state.funding_searched:
            established = state.kg_founded_year is not None and state.kg_founded_year < ESTABLISHED_BEFORE_YEAR
            if established:
                notes.append(
                    f"Funding search skipped: the company appears established (founded {state.kg_founded_year})."
                )
            else:
                candidates.append(PlannedSearch(
                    key="funding",
                    query=SearchQuery(engine="google", q=f"{company} funding", num=10,
                                      purpose="Look for funding information"),
                    reason="Company may be young or unknown, so funding context is worth checking.",
                ))
        if state.company_job_count == 0:
            candidates.append(PlannedSearch(
                key="jobs_fallback",
                query=SearchQuery(engine="google_jobs", q=f"{company} careers", pages=1,
                                  purpose="Retry finding the company's openings"),
                reason="No company listings were found by the first job searches.",
            ))
        if state.news_count == 0:
            candidates.append(PlannedSearch(
                key="news_fallback",
                query=SearchQuery(engine="google_news", q=f"{company} latest", purpose="Retry recent news"),
                reason="No relevant news was found for the company name alone.",
            ))

        chosen: list[PlannedSearch] = []
        for step in candidates:
            if step.signature in executed:
                continue
            if len(chosen) >= self._settings.max_follow_up_searches:
                notes.append(f"Follow-up '{step.key}' not run: follow-up search budget reached.")
                continue
            chosen.append(step)
        return chosen, notes

    # ---------------------------------------------------------------- LLM extras

    def _add_llm_extras(self, plan: InvestigationPlan, opp: OpportunityProfile) -> None:
        if not (self._settings.llm_planning and self._llm):
            return
        company = opp.company_name or ""
        try:
            extras = self._llm.generate_structured(
                _ExtraQueries,
                "You plan web searches to investigate an employer for a job seeker. Suggest at most 2 additional "
                "Google or Google News queries that would reveal something useful NOT covered by: the company name, "
                "'<company> jobs', '<role> <company>', '<company>' news, and the role title market sample. "
                "Every query must contain the company name.",
                f"Company: {company}\nRole: {opp.role_title}\nLocation: {opp.location}\nSkills: {', '.join(opp.all_skills)}",
                max_repairs=1,
            )
        except (ScoutLensError, ValidationError) as exc:
            logger.info("LLM query suggestions skipped: %s", exc)
            return
        existing = {s.signature for s in plan.searches}
        needle = normalize_company(company)
        added = 0
        for extra in extras.queries:
            step = PlannedSearch(
                key=f"llm_extra_{added + 1}",
                query=SearchQuery(engine=extra.engine, q=" ".join(extra.q.split()), purpose="LLM-suggested angle"),
                reason=extra.reason or "Suggested by the planning model.",
            )
            if needle not in normalize_company(extra.q) or step.signature in existing:
                continue  # must stay about this company; no duplicates
            plan.searches.append(step)
            existing.add(step.signature)
            added += 1
            if added >= _MAX_LLM_EXTRAS:
                break
        if added:
            plan.notes.append(f"{added} additional search(es) suggested by the planning model.")
