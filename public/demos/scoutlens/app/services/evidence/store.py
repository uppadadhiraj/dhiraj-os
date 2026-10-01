"""The evidence store: the only place :class:`EvidenceItem` objects are created.

Every ``add_*`` method takes an object that SerpApi actually returned (search hit, job listing,
news item, knowledge-graph panel) and copies its title, URL and text verbatim. Nothing here accepts
free-form URLs or quotes, so neither the LLM nor a bug in an analysis step can fabricate a citation.
"""
from __future__ import annotations

from collections.abc import Iterable

from datetime import datetime

from models.common import utcnow
from models.evidence import EvidenceItem, Level, SourceType, Stance
from models.opportunity import OpportunityProfile
from models.search import JobListing, KnowledgeGraph, NewsItem, SearchHit, SearchRecord
from services.evidence.source_quality import assess_confidence, classify_source
from utils.domains import host_of, registered_domain
from utils.text import mentions_company, truncate

_EXCERPT_CHARS = 400


class EvidenceStore:
    def __init__(self, company_name: str, company_domains: Iterable[str] = ()) -> None:
        self.company_name = company_name
        self._domains: set[str] = {registered_domain(d) for d in company_domains if d}
        self._items: dict[str, EvidenceItem] = {}
        self._by_key: dict[tuple[str, str], str] = {}
        self._searches: dict[str, SearchRecord] = {}

    # ------------------------------------------------------------ bookkeeping

    @property
    def items(self) -> list[EvidenceItem]:
        return list(self._items.values())

    def __len__(self) -> int:
        return len(self._items)

    @property
    def company_domains(self) -> frozenset[str]:
        return frozenset(self._domains)

    def register_search(self, record: SearchRecord) -> None:
        self._searches[record.id] = record

    def register_searches(self, records: Iterable[SearchRecord]) -> None:
        for record in records:
            self.register_search(record)

    def register_official_domain(self, url_or_domain: str) -> None:
        """Declare a domain to be the employer's own, then re-tier already-collected evidence."""
        domain = registered_domain(url_or_domain)
        if domain and domain not in self._domains:
            self._domains.add(domain)
            self._reclassify()

    def get(self, evidence_id: str) -> EvidenceItem | None:
        return self._items.get(evidence_id)

    def existing_ids(self, ids: Iterable[str]) -> list[str]:
        """The subset of ``ids`` that really exist in the store (used to validate LLM citations)."""
        return [i for i in ids if i in self._items]

    # -------------------------------------------------------------- factories

    def add_hit(
        self, hit: SearchHit, claim: str, *, relevance: Level | None = None, stance: Stance = "supporting"
    ) -> EvidenceItem:
        if relevance is None:
            relevance = self._relevance(hit.title, hit.snippet or hit.displayed_link)
        return self._add(
            claim=claim, title=hit.title, url=hit.url, kind="web", publisher=host_of(hit.url) or None,
            date=hit.date, text=hit.snippet or hit.title, relevance=relevance, stance=stance,
            search_id=hit.search_id,
        )

    def add_job(
        self, job: JobListing, claim: str, *, relevance: Level = "high", stance: Stance = "supporting"
    ) -> EvidenceItem | None:
        """Jobs without any URL cannot be cited, so they are counted elsewhere but get no evidence item."""
        url = job.url
        if not url:
            return None
        excerpt = job.description or "; ".join(job.qualifications[:3]) or job.title
        title = f"{job.title} — {job.company_name}" if job.company_name else job.title
        return self._add(
            claim=claim, title=title, url=url, kind="job", publisher=job.via, date=job.posted_at,
            text=excerpt, relevance=relevance, stance=stance, search_id=job.search_id,
        )

    def add_news(
        self, item: NewsItem, claim: str, *, relevance: Level | None = None, stance: Stance = "supporting"
    ) -> EvidenceItem:
        if relevance is None:
            relevance = self._relevance(item.title, item.snippet)
        return self._add(
            claim=claim, title=item.title, url=item.url, kind="news", publisher=item.publisher,
            date=item.date_text, text=item.snippet or item.title, relevance=relevance, stance=stance,
            search_id=item.search_id,
        )

    def add_knowledge_graph(
        self, kg: KnowledgeGraph, claim: str, *, text: str | None = None, url: str | None = None
    ) -> EvidenceItem | None:
        """Cite the panel's own source link when it has one; otherwise its website. No link => no evidence."""
        source_url = url or kg.source_url or kg.website
        if not source_url:
            return None
        return self._add(
            claim=claim, title=f"{kg.title} (Google knowledge panel)", url=source_url, kind="knowledge_graph",
            publisher=kg.source_name or "Google", date=None, text=text or kg.description or kg.title,
            relevance="high", stance="supporting", search_id=kg.search_id,
        )

    def add_opportunity(self, opp: OpportunityProfile, claim: str = "The supplied listing") -> EvidenceItem | None:
        """Cite the listing page that was actually fetched. Pasted text has no URL, so it cannot be cited."""
        if opp.extraction_method == "manual" or not opp.source_url:
            return None
        title = f"{opp.role_title or 'Job listing'} — {opp.company_name}" if opp.company_name else (opp.role_title or "Job listing")
        return self._add(
            claim=claim, title=title, url=opp.source_url, kind="job", publisher=host_of(opp.source_url) or None,
            date=opp.date_posted, text=opp.description or title, relevance="high", stance="supporting",
            search_id="page", retrieved_at=opp.extracted_at,
        )

    def upgrade_confidence(self, ids: Iterable[str]) -> None:
        """Raise confidence one level for items whose claim was corroborated by independent signals."""
        order: list[Level] = ["low", "medium", "high"]
        for evidence_id in ids:
            item = self._items.get(evidence_id)
            if item and item.confidence != "high":
                item.confidence = order[order.index(item.confidence) + 1]

    # --------------------------------------------------------------- internals

    def _relevance(self, title: str, body: str | None) -> Level:
        if mentions_company(title, self.company_name):
            return "high"
        if mentions_company(body, self.company_name):
            return "medium"
        return "low"

    def _classify(self, url: str, publisher: str | None, kind: SourceType):
        return classify_source(
            url, publisher=publisher, kind=kind, company_domains=self._domains, company_name=self.company_name
        )

    def _add(
        self, *, claim: str, title: str, url: str, kind: SourceType, publisher: str | None, date: str | None,
        text: str, relevance: Level, stance: Stance, search_id: str, retrieved_at: datetime | None = None,
    ) -> EvidenceItem:
        key = (url, claim)
        if key in self._by_key:
            return self._items[self._by_key[key]]
        quality = self._classify(url, publisher, kind)
        source_type: SourceType = "company_site" if quality.tier == 1 and kind == "web" else kind
        record = self._searches.get(search_id)
        item = EvidenceItem(
            id=f"E{len(self._items) + 1}",
            claim=claim,
            source_title=truncate(title, 200),
            source_url=url,
            source_type=source_type,
            publisher=publisher,
            date=date,
            evidence_text=truncate(text, _EXCERPT_CHARS),
            relevance=relevance,
            confidence=assess_confidence(quality.tier, relevance),  # type: ignore[arg-type]
            supporting_or_contradicting=stance,
            tier=quality.tier,  # type: ignore[arg-type]
            tier_label=quality.label,
            search_id=search_id,
            retrieved_at=retrieved_at or (record.fetched_at if record else utcnow()),
        )
        self._items[item.id] = item
        self._by_key[key] = item.id
        return item

    def _reclassify(self) -> None:
        for item in self._items.values():
            kind: SourceType = "web" if item.source_type == "company_site" else item.source_type
            quality = self._classify(item.source_url, item.publisher, kind)
            item.tier, item.tier_label = quality.tier, quality.label  # type: ignore[assignment]
            item.confidence = assess_confidence(quality.tier, item.relevance)  # type: ignore[assignment]
            if quality.tier == 1 and kind == "web":
                item.source_type = "company_site"
