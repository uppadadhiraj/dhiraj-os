"""News Agent: runs the planned Google News searches and produces a NewsSignal."""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from models.opportunity import OpportunityProfile
from models.plan import PlannedSearch
from models.report import NewsSignal
from models.search import NewsItem
from services.analysis.news import analyze_news
from services.evidence.store import EvidenceStore
from services.llm.base import LLMProvider
from services.serpapi.client import SerpApiClient
from services.serpapi.news import fetch_news
from utils.errors import ScoutLensError, SerpApiError
from utils.language_guard import is_neutral

logger = logging.getLogger(__name__)
_MAX_REASON_CHARS = 160


class _Judgement(BaseModel):
    index: int
    relevance: Literal["high", "medium", "low"]
    why: str = Field(max_length=_MAX_REASON_CHARS)


class _Judgements(BaseModel):
    items: list[_Judgement] = Field(default_factory=list)


class NewsAgent:
    def __init__(self, client: SerpApiClient, store: EvidenceStore, llm: LLMProvider | None = None) -> None:
        self._client = client
        self._store = store
        self._llm = llm
        self.errors: list[str] = []
        self.llm_applied = False  # whether the LLM's relevance judgements were used
        self._items: list[NewsItem] = []  # accumulated across rounds (initial search + fallbacks)
        self._search_ids: list[str] = []

    def investigate(
        self, opp: OpportunityProfile, steps: list[PlannedSearch], *, max_items: int = 8, refresh: bool = False
    ) -> tuple[NewsSignal, list[NewsItem]]:
        items: list[NewsItem] = []
        search_ids: list[str] = []
        for step in steps:
            before = len(self._client.records)
            try:
                items += fetch_news(self._client, step.query, refresh=refresh)
            except SerpApiError as exc:
                if exc.is_fatal:
                    raise
                logger.warning("News search '%s' failed: %s", step.key, exc.kind)
                self.errors.append(f"News search '{step.query.q}' failed: {exc.user_message}")
            finally:
                search_ids += [r.id for r in self._client.records[before:]]
                self._store.register_searches(self._client.records)
        self._items += items
        self._search_ids += search_ids
        signal, relevant = analyze_news(opp, self._items, self._store, search_ids=self._search_ids, max_items=max_items)
        signal.notes.extend(self.errors)
        if self._llm and signal.items:
            self._refine_with_llm(opp, signal)
        return signal, relevant

    def _refine_with_llm(self, opp: OpportunityProfile, signal: NewsSignal) -> None:
        """One batched call: judge each item's relevance to the role. Anything invalid or non-neutral is ignored."""
        listing = "\n".join(f"{i}. {n.title}" + (f" — {n.summary}" if n.summary else "") for i, n in enumerate(signal.items))
        try:
            result = self._llm.generate_structured(  # type: ignore[union-attr]
                _Judgements,
                "You judge how relevant company news is to a job seeker considering one role. Use ONLY the headline "
                "and summary given. For each numbered item return its index, relevance (high, medium or low) and a "
                f"neutral one-sentence reason under {_MAX_REASON_CHARS} characters. Do not praise or criticise the company.",
                f"Role: {opp.role_title} at {signal.company}\nSkills: {', '.join(opp.all_skills)}\n\nNews:\n{listing}",
                max_repairs=1,
            )
        except ScoutLensError as exc:
            logger.info("LLM news refinement skipped: %s", exc)
            return
        applied = 0
        for judgement in result.items:
            if not 0 <= judgement.index < len(signal.items) or not is_neutral(judgement.why):
                continue
            item = signal.items[judgement.index]
            item.relevance, item.relevance_reason = judgement.relevance, judgement.why.strip()
            applied += 1
        if applied:
            self.llm_applied = True
            rank = {"high": 0, "medium": 1, "low": 2}
            signal.items.sort(key=lambda n: rank[n.relevance])  # stable: keeps recency order within a level
