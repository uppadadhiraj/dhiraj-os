"""Hiring Agent: runs the planned Google Jobs searches and turns the results into a HiringSignal."""
from __future__ import annotations

import logging

from models.opportunity import OpportunityProfile
from models.plan import PlannedSearch
from models.report import HiringSignal
from models.search import JobListing
from services.analysis.hiring import analyze_hiring
from services.evidence.store import EvidenceStore
from services.serpapi.client import SerpApiClient
from services.serpapi.jobs import fetch_jobs_with_fallback
from utils.errors import SerpApiError

logger = logging.getLogger(__name__)


class HiringAgent:
    def __init__(self, client: SerpApiClient, store: EvidenceStore, default_location: str | None = None) -> None:
        self._client = client
        self._store = store
        self._default_location = default_location
        self.errors: list[str] = []  # non-fatal failures, surfaced as report warnings
        self.region_notes: list[str] = []  # searches that fell back to another region
        self.fell_back = False
        self.region_used: str | None = default_location
        self._listings: list[JobListing] = []  # accumulated across rounds (initial searches + fallbacks)
        self._search_ids: list[str] = []

    def collect(self, steps: list[PlannedSearch], *, refresh: bool = False) -> tuple[list[JobListing], list[str]]:
        """Run each job search; returns ``(listings, ids of the searches that were executed)``.

        Fatal SerpApi errors (bad key, quota) propagate so the investigator can stop cleanly; other
        failures are recorded in ``errors`` and the remaining searches still run.
        """
        listings: list[JobListing] = []
        search_ids: list[str] = []
        for step in steps:
            before = len(self._client.records)
            try:
                fetched = fetch_jobs_with_fallback(self._client, step.query, self._default_location, refresh=refresh)
                listings += fetched.listings
                self.region_used = fetched.location_used
                if fetched.fell_back:
                    self.fell_back = True
                    self.region_notes.append(
                        f"Google Jobs has no listings for '{fetched.requested_location}', so '{step.query.q}' "
                        f"was searched in '{fetched.location_used}' instead."
                    )
            except SerpApiError as exc:
                if exc.is_fatal:
                    raise
                logger.warning("Job search '%s' failed: %s", step.key, exc.kind)
                self.errors.append(f"Job search '{step.query.q}' failed: {exc.user_message}")
            finally:
                search_ids += [r.id for r in self._client.records[before:]]
                self._store.register_searches(self._client.records)
        return listings, search_ids

    def investigate(
        self, opp: OpportunityProfile, steps: list[PlannedSearch], *, refresh: bool = False
    ) -> HiringSignal:
        """Run ``steps`` and analyse everything collected so far (safe to call again with follow-up steps)."""
        listings, search_ids = self.collect(steps, refresh=refresh)
        self._listings += listings
        self._search_ids += search_ids
        signal = analyze_hiring(
            opp, self._listings, self._store, search_ids=self._search_ids,
            same_region=not self.fell_back, search_region=self.region_used,
        )
        signal.notes.extend(dict.fromkeys([*self.region_notes, *self.errors]))
        return signal
