"""Investigator: runs the whole investigation and assembles the evidence-backed report.

Pipeline (each stage is a real operation and reports progress in true execution order):

    read -> plan -> identify -> hiring -> news -> follow-up -> resume -> market -> correlate -> report

The follow-up stage inspects what the first round actually found and searches again only where
evidence is thin. A failure in one stage yields a *partial* report with a warning, never a traceback;
the only exception raised to the caller is a fatal SerpApi error on the very first search
(nothing can be investigated without live search).
"""
from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from agents.company_agent import CompanyAgent, CompanyResult
from agents.hiring_agent import HiringAgent
from agents.market_agent import MarketAgent
from agents.news_agent import NewsAgent
from agents.planner import InvestigationPlanner
from agents.report_agent import build_indicators, build_method, build_next_actions
from config import Settings
from models.common import utcnow
from models.opportunity import OpportunityProfile
from models.plan import InvestigationPlan, PlanState, PlannedSearch
from models.preferences import UserPreferences
from models.report import (
    CrossCheck, Finding, HiringSignal, Indicator, InvestigationReport, MarketAnalysis, NewsSignal, NextAction,
)
from models.resume import FitSummary, ResumeProfile
from models.search import NewsItem
from services.analysis.findings import build_findings
from services.evidence.crosscheck import run_crosschecks
from services.evidence.store import EvidenceStore
from services.llm.base import LLMProvider
from services.resume.matching import match_skills
from services.resume.parser import add_self_reported_skills
from services.serpapi.client import SerpApiClient
from utils.errors import ScoutLensError, SerpApiError

logger = logging.getLogger(__name__)

StageKey = Literal["read", "plan", "identify", "hiring", "news", "followup", "resume", "market", "correlate", "report"]
STAGES: tuple[tuple[StageKey, str], ...] = (
    ("read", "Reading opportunity"),
    ("plan", "Planning the investigation"),
    ("identify", "Identifying organization"),
    ("hiring", "Investigating hiring patterns"),
    ("news", "Searching recent news"),
    ("followup", "Searching again where evidence is thin"),
    ("resume", "Analyzing resume"),
    ("market", "Comparing market signals"),
    ("correlate", "Correlating evidence"),
    ("report", "Generating report"),
)
_LABELS = dict(STAGES)


@dataclass
class ProgressEvent:
    stage: StageKey
    label: str
    status: Literal["running", "done", "skipped", "failed"]
    detail: str = ""
    index: int = 0  # 1-based position of the stage
    total: int = len(STAGES)


ProgressCallback = Callable[[ProgressEvent], None]


@dataclass
class _Agents:
    company: CompanyAgent
    hiring: HiringAgent
    news: NewsAgent
    market: MarketAgent


@dataclass
class _Run:
    """Mutable state of one investigation."""

    opp: OpportunityProfile
    prefs: UserPreferences
    resume: ResumeProfile | None
    refresh: bool
    store: EvidenceStore
    started_at: datetime
    on_progress: ProgressCallback | None
    plan: InvestigationPlan | None = None
    company: CompanyResult | None = None
    hiring: HiringSignal | None = None
    news: NewsSignal | None = None
    news_relevant: list[NewsItem] = field(default_factory=list)
    market: MarketAnalysis | None = None
    fit: FitSummary | None = None
    findings: list[Finding] = field(default_factory=list)
    crosschecks: list[CrossCheck] = field(default_factory=list)
    indicators: list[Indicator] = field(default_factory=list)
    next_actions: list[NextAction] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    failed_stages: list[str] = field(default_factory=list)
    fatal: SerpApiError | None = None
    executed: set[tuple[str, str]] = field(default_factory=set)
    listing_evidence_id: str | None = None
    llm_used_for: list[str] = field(default_factory=list)
    funding_searched: bool = False
    finished_at: datetime | None = None
    agents: _Agents | None = None


class Investigator:
    def __init__(self, settings: Settings, client: SerpApiClient, llm: LLMProvider | None = None) -> None:
        self._settings = settings
        self._client = client
        self._llm = llm

    # ------------------------------------------------------------------ public

    def run(
        self,
        opp: OpportunityProfile,
        *,
        resume: ResumeProfile | None = None,
        prefs: UserPreferences | None = None,
        refresh: bool = False,
        on_progress: ProgressCallback | None = None,
        is_demo: bool = False,
        now: datetime | None = None,
        announce_read: bool = True,
    ) -> InvestigationReport:
        if not opp.is_investigable:
            raise ScoutLensError("A company name is needed to investigate this opportunity. Please enter it.")
        self._client.records.clear()
        state = _Run(
            opp=opp, prefs=prefs or UserPreferences(), resume=resume, refresh=refresh,
            store=EvidenceStore(opp.company_name or ""), started_at=now or utcnow(), on_progress=on_progress,
        )
        llm, llm_status = self._check_llm(state)
        self._build_agents(state, llm)
        planner = InvestigationPlanner(self._settings, llm)

        if announce_read:  # the pipeline reports this stage itself when it performs the fetch
            self._emit(state, "read", "done", f"{opp.role_title or 'Role'} at {opp.company_name}")
        self._stage(state, "plan", lambda: self._plan(state, planner), needs_search=False)
        self._stage(state, "identify", lambda: self._identify(state), fatal_raises=True)
        self._stage(state, "hiring", lambda: self._hiring(state))
        self._stage(state, "news", lambda: self._news(state))
        self._stage(state, "followup", lambda: self._followup(state, planner))
        self._stage(state, "resume", lambda: self._resume(state), needs_search=False)
        self._stage(state, "market", lambda: self._market(state))
        self._stage(state, "correlate", lambda: self._correlate(state), needs_search=False)
        return self._finish(state, llm_status, is_demo)

    # ----------------------------------------------------------------- plumbing

    def _build_agents(self, state: _Run, llm: LLMProvider | None) -> None:
        state.agents = _Agents(
            company=CompanyAgent(self._client, state.store, llm),
            hiring=HiringAgent(self._client, state.store, self._settings.serpapi_location),
            news=NewsAgent(self._client, state.store, llm),
            market=MarketAgent(self._client, state.store, self._settings.serpapi_location),
        )

    def _check_llm(self, state: _Run) -> tuple[LLMProvider | None, str | None]:
        if self._llm is None:
            return None, None
        ok, status = self._llm.check_available()
        if ok:
            return self._llm, status
        if self._settings.llm_provider != "none":
            state.warnings.append(f"Language model not available ({status}). ScoutLens used deterministic analysis only.")
        return None, None

    def _emit(self, state: _Run, key: StageKey, status: str, detail: str = "") -> None:
        if state.on_progress:
            index = next(i for i, (k, _l) in enumerate(STAGES, start=1) if k == key)
            try:
                state.on_progress(ProgressEvent(stage=key, label=_LABELS[key], status=status, detail=detail, index=index))  # type: ignore[arg-type]
            except Exception:  # noqa: BLE001 - a broken UI callback must never break the investigation
                logger.exception("Progress callback failed")

    def _stage(
        self, state: _Run, key: StageKey, fn: Callable[[], str | None], *, needs_search: bool = True, fatal_raises: bool = False
    ) -> None:
        if needs_search and state.fatal is not None:
            self._emit(state, key, "skipped", "Skipped because live search became unavailable.")
            state.failed_stages.append(key)
            return
        self._emit(state, key, "running")
        try:
            detail = fn()
        except SerpApiError as exc:
            self._emit(state, key, "failed", exc.user_message)
            if exc.is_fatal:
                if fatal_raises:
                    raise
                state.fatal = exc
                state.warnings.append(f"{exc.user_message} Results below are incomplete.")
            else:
                state.warnings.append(exc.user_message)
            state.failed_stages.append(key)
        except ScoutLensError as exc:
            logger.warning("Stage %s failed: %s", key, exc)
            self._emit(state, key, "failed", exc.user_message)
            state.warnings.append(exc.user_message)
            state.failed_stages.append(key)
        except Exception:  # noqa: BLE001 - one stage must not take the whole investigation down
            logger.exception("Stage %s failed unexpectedly", key)
            message = f"The step '{_LABELS[key]}' failed unexpectedly and was skipped."
            self._emit(state, key, "failed", message)
            state.warnings.append(message)
            state.failed_stages.append(key)
        else:
            self._emit(state, key, "skipped" if detail and detail.startswith("Skipped:") else "done", detail or "")

    # ------------------------------------------------------------------ stages

    def _mark(self, state: _Run, *steps: PlannedSearch) -> None:
        state.executed.update(s.signature for s in steps)

    def _plan(self, state: _Run, planner: InvestigationPlanner) -> str:
        state.plan = planner.initial_plan(state.opp, state.prefs)
        if any(s.key.startswith("llm_extra") for s in state.plan.searches):
            state.llm_used_for.append("search planning")
        state.listing_evidence_id = (item.id if (item := state.store.add_opportunity(state.opp)) else None)
        return f"{len(state.plan.searches)} searches planned"

    def _identify(self, state: _Run) -> str:
        assert state.plan is not None
        extras = [s for s in state.plan.searches if s.key.startswith("llm_extra") and s.query.engine == "google"]
        identity = state.plan.step("identity")
        assert identity is not None
        self._mark(state, identity, *extras)
        state.company = state.agents.company.investigate(state.opp, identity, extra_identity=extras, refresh=state.refresh)
        profile = state.company.profile
        if profile.overview_source == "llm":
            state.llm_used_for.append("company overview")
        return f"{profile.name}: official website {'identified' if profile.website else 'not established'}"

    def _hiring(self, state: _Run) -> str:
        assert state.plan is not None
        steps = [s for s in (state.plan.step("jobs_company"), state.plan.step("jobs_role")) if s]
        self._mark(state, *steps)
        state.hiring = state.agents.hiring.investigate(state.opp, steps, refresh=state.refresh)
        return f"{state.hiring.sample_size} other current listings analysed"

    def _news(self, state: _Run) -> str:
        assert state.plan is not None
        steps = [s for s in state.plan.searches if s.key == "news" or (s.key.startswith("llm_extra") and s.query.engine == "google_news")]
        self._mark(state, *steps)
        self._run_news(state, steps)
        assert state.news is not None
        return f"{len(state.news.items)} relevant news items"

    def _run_news(self, state: _Run, steps: list[PlannedSearch]) -> None:
        state.news, state.news_relevant = state.agents.news.investigate(
            state.opp, steps, max_items=self._settings.max_news_items, refresh=state.refresh
        )
        if state.company:
            state.agents.company.add_funding_from_news(state.company.profile, state.news_relevant)
        if state.agents.news.llm_applied and "news relevance" not in state.llm_used_for:
            state.llm_used_for.append("news relevance")

    def _followup(self, state: _Run, planner: InvestigationPlanner) -> str:
        assert state.plan is not None
        company = state.company
        plan_state = PlanState(
            has_knowledge_graph=bool(company and company.has_knowledge_graph),
            kg_founded_year=company.kg_founded_year if company else None,
            official_domain_found=bool(company and company.profile.website),
            company_job_count=state.hiring.sample_size if state.hiring else 0,
            news_count=len(state.news.items) if state.news else 0,
            funding_searched=state.funding_searched,
        )
        steps, notes = planner.follow_ups(state.opp, plan_state, state.executed)
        state.plan.notes.extend(notes)
        ran: list[str] = []
        for step in steps:
            self._mark(state, step)
            if step.key == "official_site" and company:
                state.agents.company.retry_website(company, state.opp, step, refresh=state.refresh)
            elif step.key == "funding" and company:
                state.agents.company.add_funding(company, step, refresh=state.refresh)
                state.funding_searched = True
            elif step.key == "jobs_fallback":
                state.hiring = state.agents.hiring.investigate(state.opp, [step], refresh=state.refresh)
            elif step.key == "news_fallback":
                self._run_news(state, [step])
            else:
                continue
            ran.append(step.key.replace("_", " "))
        state.plan.notes.extend(f"Follow-up search ran: {step.reason}" for step in steps if step.key.replace("_", " ") in ran)
        return f"Ran {len(ran)} follow-up search(es): {', '.join(ran)}" if ran else "No evidence gaps needed follow-up searches"

    def _resume(self, state: _Run) -> str:
        profile = state.resume
        if profile is None and state.prefs.skills:
            profile = ResumeProfile(source="entered", quality="good")
        if profile is None:
            return "Skipped: no resume or skills were supplied"
        if state.prefs.skills:
            add_self_reported_skills(profile, state.prefs.skills)
        state.resume = profile
        state.fit = match_skills(state.opp, profile)
        coverage = state.fit.coverage_percent
        return f"{state.fit.matched} of {state.fit.total_requirements} listed skills matched" + (f" ({coverage:g}%)" if coverage is not None else "")

    def _market(self, state: _Run) -> str:
        assert state.plan is not None
        step = state.plan.step("market")
        if step is None:
            return "Skipped: no role title to sample the market with"
        self._mark(state, step)
        state.market = state.agents.market.investigate(state.opp, step, resume=state.resume, refresh=state.refresh)
        return f"{state.market.sample_size} listings sampled"

    def _correlate(self, state: _Run) -> str:
        opp, store = state.opp, state.store
        company = state.company.profile if state.company else None
        state.crosschecks = run_crosschecks(opp, company, state.hiring, store, listing_evidence_id=state.listing_evidence_id)
        try:
            tz = ZoneInfo(self._settings.display_timezone)
        except ZoneInfoNotFoundError:
            tz = ZoneInfo("UTC")
        state.findings = build_findings(
            opp, company, state.hiring, state.news, state.market, store,
            resume_supplied=state.resume is not None, listing_evidence_id=state.listing_evidence_id,
            today=state.started_at.astimezone(tz).date(),
        )
        state.next_actions = build_next_actions(
            opp=opp, company=company, hiring=state.hiring, market=state.market, fit=state.fit,
            findings=state.findings, listing_evidence_id=state.listing_evidence_id, store=store,
        )
        return f"{len(state.findings)} findings, {len(state.crosschecks)} cross-checks, {len(store)} evidence items"

    # ------------------------------------------------------------------ assembly

    def _finish(self, state: _Run, llm_status: str | None, is_demo: bool) -> InvestigationReport:
        self._emit(state, "report", "running")
        state.finished_at = utcnow()
        records = list(self._client.records)
        state.store.register_searches(records)
        failed = [r for r in records if r.error]
        if failed:
            state.warnings.append(f"{len(failed)} of {len(records)} searches failed; results may be incomplete.")
        state.indicators = build_indicators(
            hiring=state.hiring, market=state.market, news=state.news, fit=state.fit, records=records, store=state.store
        )
        method = build_method(
            started_at=state.started_at, finished_at=state.finished_at, records=records, hiring=state.hiring,
            market=state.market, news=state.news, store=state.store, refreshed=state.refresh, llm_status=llm_status,
            llm_used_for=state.llm_used_for, plan_notes=state.plan.notes if state.plan else [],
            tz_name=self._settings.display_timezone,
        )
        report = InvestigationReport(
            id=uuid.uuid4().hex[:12],
            created_at=state.started_at,
            status="partial" if state.failed_stages or state.fatal or failed else "complete",
            is_demo=is_demo,
            opportunity=state.opp,
            company=state.company.profile if state.company else None,
            hiring=state.hiring,
            news=state.news,
            market=state.market,
            resume=state.resume,
            preferences=state.prefs,
            fit=state.fit,
            findings=state.findings,
            crosschecks=state.crosschecks,
            evidence=state.store.items,
            indicators=state.indicators,
            next_actions=state.next_actions,
            method=method,
            warnings=list(dict.fromkeys(state.warnings)),
        )
        self._emit(state, "report", "done", f"{len(report.findings)} findings · {len(report.evidence)} evidence items")
        return report
