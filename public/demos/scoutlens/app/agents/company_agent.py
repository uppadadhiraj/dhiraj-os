"""Company Agent: establishes who the employer is, using only retrieved results.

Identity comes from Google's knowledge panel and organic results. The official website is the
listing's own domain, the panel's website, or (weakest) a top result whose domain matches the company
name; the basis is always recorded. Products and funding are *verbatim excerpts* with citations, not
paraphrases. The overview is the panel description, or LLM prose that survives citation validation.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from models.company import CompanyFact, CompanyProfile
from models.opportunity import OpportunityProfile
from models.plan import PlannedSearch
from models.search import KnowledgeGraph, NewsItem, SearchHit
from services.evidence.citations import validate_prose
from services.evidence.store import EvidenceStore
from services.llm.base import LLMProvider
from services.serpapi.client import SerpApiClient
from services.serpapi.search import GoogleResults, fetch_google
from utils.domains import is_job_board_or_ats, origin_of, registered_domain
from utils.errors import ScoutLensError
from utils.language_guard import is_neutral
from utils.text import GENERIC_TRAILING_WORDS, brand_alias, mentions_company, normalize_company, truncate

logger = logging.getLogger(__name__)

FUNDING_PATTERN = re.compile(
    r"\b(raised|raises|raising|funding|funded|investment|invests|invested|round|series [a-f]|seed|backed by)\b", re.I
)
# Stock sales, earnings and dividends mention money and investors without being about funding the company.
_NOT_FUNDING = re.compile(r"\b(stock|shares?|selling|sells|sold|earnings|dividend|buyback|price target)\b", re.I)
# A funding statement must name an amount or a specific round; "investor day recap" or "founder funding
# military AI" mention the topic without saying anything about *this company's* funding.
_AMOUNT = re.compile(r"[$€£₹]\s?\d|\b\d+(?:\.\d+)?\s?(?:million|billion|crore|lakh|[MB])\b", re.I)
_ROUND = re.compile(r"\bseries [a-f]\b|\bseed round\b|\bpre-seed\b|\bfunding round\b|\bacquired by\b", re.I)
# Pages that say nothing descriptive about the business: logins, downloads, single songs/videos.
_UTILITY_URL = re.compile(
    r"/(?:login|log-in|signin|sign-in|signup|sign-up|register|account|download|cart|checkout|track|album|playlist|"
    r"artist|episode|shorts|watch|reel|status)(?:/|$|\?)",
    re.I,
)
_BOILERPLATE_SNIPPET = re.compile(r"^(?:no information is available for this page|a description for this result is not available)", re.I)
_ABOUT_URL = re.compile(r"/(?:about|company|who-we-are|our-story|overview|press|newsroom|careers|investors?)(?:/|$|-)", re.I)
# Company-profile pages describe the business; storefront pages sell it ("Grab Exciting Deals - Unbeatable Prices").
_PROFILE_URL = re.compile(r"(?:wikipedia\.org/wiki/|linkedin\.com/(?:company|school)/|crunchbase\.com/organization/)", re.I)
_PROMO = re.compile(
    r"\b(unbeatable|exciting deals?|best prices?|lowest prices?|download the app|shop now|grab|free shipping|limited[- ]time|"
    r"order now|sign up (?:now|today)|use code|coupon|cashback|discounts?)\b",
    re.I,
)
_MIN_DESCRIPTIVE_SNIPPET = 40
_ABOUT_COMPANY_START = re.compile(r"^(?:it|its|they|the company|the organi[sz]ation)\b", re.I)
_MIN_GROUNDING = 0.5
_MAX_RELEVANT_HITS = 6
_MAX_PRODUCT_FACTS = 2
_MAX_FUNDING_FACTS = 3
_MAX_LLM_EXCERPTS = 5
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_OVERVIEW_SYSTEM = (
    "You write neutral, factual company overviews for job seekers using ONLY the numbered excerpts provided. "
    "Describe what the company itself does. Ignore excerpts that are about songs, playlists, videos, login pages or "
    "anything other than the company's business. Every sentence must name the company (or start with 'It') and end "
    "with one or more citation markers such as [E3] naming the excerpts that support it. Do not add facts that are "
    "not in the excerpts. Do not praise, criticise or evaluate the company, and do not repeat promotional or marketing "
    "language (best, unbeatable, exciting deals). If the excerpts do not describe the company's business, reply with "
    "an empty string."
)


def _first_funding_word(text: str) -> int | None:
    positions = [m.start() for m in (FUNDING_PATTERN.search(text), _ROUND.search(text)) if m]
    return min(positions) if positions else None


def is_funding_fact(text: str, company: str | None = None) -> bool:
    """Funding coverage that says something concrete: a money amount with a funding word, or a named round.

    With ``company`` given, the company must be mentioned *before* the funding words, so "Blissclub founder's
    stake slips after Series B; Meesho's founder holds 6.9%" is not read as Meesho funding news.
    """
    money = bool(_AMOUNT.search(text) and FUNDING_PATTERN.search(text) and not _NOT_FUNDING.search(text))
    if not (money or _ROUND.search(text)):
        return False
    if company:
        lowered = text.lower()
        names = [n for n in (normalize_company(company), brand_alias(company)) if n]
        at = [lowered.find(n) for n in names if lowered.find(n) != -1]
        funding_at = _first_funding_word(text)
        if not at or (funding_at is not None and min(at) > funding_at):
            return False
    return True


def is_descriptive(hit: SearchHit) -> bool:
    """Whether a result can serve as a description of the business (not boilerplate, login or content pages)."""
    snippet = hit.snippet or ""
    return len(snippet) >= _MIN_DESCRIPTIVE_SNIPPET and not _BOILERPLATE_SNIPPET.search(snippet) and not _UTILITY_URL.search(hit.url)


@dataclass
class CompanyResult:
    profile: CompanyProfile
    kg_founded_year: int | None = None
    has_knowledge_graph: bool = False
    relevant_hits: list[SearchHit] = field(default_factory=list)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _domain_matches_company(url: str, company: str) -> bool:
    """Whether the URL's registered-domain label *is* the company's name.

    Deliberately strict, because a match makes the domain "official" (Tier 1): the label must equal the
    name with hyphens removed, or the name minus one trailing generic word ("Razorpay Software" ->
    razorpay.com). Lookalikes such as ``northwindlabs-review.com`` never match.
    """
    label = _slug(registered_domain(url).split(".")[0])
    words = normalize_company(company).split()
    if not label or not words:
        return False
    accepted = {_slug("".join(words))}
    if len(words) > 1 and words[-1] in GENERIC_TRAILING_WORDS:
        accepted.add(_slug("".join(words[:-1])))
    return label in accepted


class CompanyAgent:
    def __init__(self, client: SerpApiClient, store: EvidenceStore, llm: LLMProvider | None = None) -> None:
        self._client = client
        self._store = store
        self._llm = llm

    # ------------------------------------------------------------------ public

    def investigate(
        self,
        opp: OpportunityProfile,
        identity: PlannedSearch,
        *,
        extra_identity: list[PlannedSearch] | None = None,
        refresh: bool = False,
    ) -> CompanyResult:
        """Run the identity search (and any extra identity-type searches) and assemble the profile."""
        company = opp.company_name or ""
        profile = CompanyProfile(name=company)
        results = [self._run(identity, refresh)]
        for step in extra_identity or []:
            results.append(self._run(step, refresh))

        kg = next((r.knowledge_graph for r in results if r.knowledge_graph), None)
        hits = self._relevant_hits(company, [h for r in results for h in r.hits])
        self._establish_website(profile, opp, kg, hits)
        kg_year = self._apply_knowledge_graph(profile, kg)
        self._add_product_facts(profile, hits)
        self._build_overview(profile, hits, kg)

        profile.identity_confirmed = bool(kg or profile.website)
        all_hits = [h for r in results for h in r.hits]
        profile.ambiguous = not kg and bool(all_hits) and len(hits) / len(all_hits) < 0.3
        if profile.ambiguous:
            profile.gaps.append(
                "Search results did not clearly identify this company (few results mention its name); "
                "findings about it should be verified."
            )
        if not profile.website:
            profile.gaps.append("Insufficient evidence: the official website could not be identified.")
        if not profile.overview:
            profile.gaps.append("Insufficient evidence: no company overview was found in the retrieved results.")
        return CompanyResult(profile=profile, kg_founded_year=kg_year, has_knowledge_graph=kg is not None, relevant_hits=hits)

    def retry_website(self, result: CompanyResult, opp: OpportunityProfile, step: PlannedSearch, *, refresh: bool = False) -> None:
        """A dedicated "official website" search for when the first search did not establish one."""
        profile = result.profile
        if profile.website:
            return
        found = self._run(step, refresh)
        hits = self._relevant_hits(profile.name, found.hits)
        result.relevant_hits = [*result.relevant_hits, *(h for h in hits if h not in result.relevant_hits)]
        self._establish_website(profile, opp, found.knowledge_graph, hits)
        if not profile.website:
            return
        profile.identity_confirmed = True
        # The first search can miss (a bare or generic query returns unrelated pages); this one found the company,
        # so use its results for everything the first one could not provide instead of discarding them.
        if found.knowledge_graph and not result.has_knowledge_graph:
            result.kg_founded_year = self._apply_knowledge_graph(profile, found.knowledge_graph)
            result.has_knowledge_graph = True
        if not profile.products:
            self._add_product_facts(profile, hits)
        if not profile.overview:
            self._build_overview(profile, hits, found.knowledge_graph)
        profile.ambiguous = False
        profile.gaps = [
            g for g in profile.gaps
            if "official website" not in g and "did not clearly identify" not in g and not (profile.overview and "no company overview" in g)
        ]

    def add_funding(self, result: CompanyResult, step: PlannedSearch, *, refresh: bool = False) -> None:
        """Run the funding search and attach verbatim funding excerpts (with citations) to the profile."""
        profile = result.profile
        found = self._run(step, refresh)
        candidates = [h for h in self._relevant_hits(profile.name, found.hits) if is_funding_fact(f"{h.title} {h.snippet}", profile.name)]
        for hit in candidates[:_MAX_FUNDING_FACTS]:
            item = self._store.add_hit(hit, f"Search result mentions funding or investment for {profile.name}")
            profile.funding.append(CompanyFact(text=truncate(hit.snippet or hit.title, 300), evidence_ids=[item.id]))
        if not profile.funding:
            profile.gaps.append("No funding information was found in the retrieved results.")

    def add_funding_from_news(self, profile: CompanyProfile, news: list[NewsItem]) -> None:
        """News headlines/snippets that mention funding also count, with the news item as the citation."""
        seen = {f.text for f in profile.funding}
        for item in news:
            text = truncate(item.snippet or item.title, 300)
            if len(profile.funding) >= _MAX_FUNDING_FACTS or text in seen:
                continue
            if mentions_company(f"{item.title} {item.snippet}", profile.name) and is_funding_fact(f"{item.title} {item.snippet}", profile.name):
                evidence = self._store.add_news(item, f"News coverage mentions funding or investment for {profile.name}")
                profile.funding.append(CompanyFact(text=text, evidence_ids=[evidence.id]))
                seen.add(text)
        if profile.funding:
            profile.gaps = [g for g in profile.gaps if not g.startswith("No funding information")]

    # ---------------------------------------------------------------- internals

    def _run(self, step: PlannedSearch, refresh: bool) -> GoogleResults:
        try:
            return fetch_google(self._client, step.query, refresh=refresh)
        finally:
            self._store.register_searches(self._client.records)

    def _relevant_hits(self, company: str, hits: list[SearchHit]) -> list[SearchHit]:
        """Organic results that actually concern the company (by name in title/snippet or by domain)."""
        relevant = [
            h for h in hits
            if mentions_company(h.title, company) or mentions_company(h.snippet, company) or _domain_matches_company(h.url, company)
        ]
        return relevant[:_MAX_RELEVANT_HITS]

    def _establish_website(
        self, profile: CompanyProfile, opp: OpportunityProfile, kg: KnowledgeGraph | None, hits: list[SearchHit]
    ) -> None:
        listing_url = opp.application_url or opp.source_url
        website, basis = None, None
        if kg and kg.website:
            website, basis = kg.website, "Listed as the website in Google's knowledge panel"
        elif listing_url and not is_job_board_or_ats(listing_url) and _domain_matches_company(listing_url, opp.company_name or ""):
            website, basis = origin_of(listing_url), "The listing itself is hosted on this domain"
        else:
            match = next(
                (h for h in hits[:5] if not is_job_board_or_ats(h.url) and _domain_matches_company(h.url, profile.name)), None
            )
            if match:
                website, basis = origin_of(match.url), "Inferred: top search result whose domain matches the company name"
        if not website:
            return
        self._store.register_official_domain(website)
        if listing_url and not is_job_board_or_ats(listing_url) and _domain_matches_company(listing_url, opp.company_name or ""):
            self._store.register_official_domain(listing_url)
        profile.website, profile.website_basis = website, basis
        if kg and kg.website == website:
            item = self._store.add_knowledge_graph(
                kg, f"Official website: {website}", text=f"Google's knowledge panel for {kg.title} lists the website {website}.", url=website
            )
            if item:
                profile.website_evidence_ids.append(item.id)
        else:
            hit = next((h for h in hits if registered_domain(h.url) == registered_domain(website)), None)
            if hit:
                profile.website_evidence_ids.append(self._store.add_hit(hit, f"Official website: {website}").id)

    def _apply_knowledge_graph(self, profile: CompanyProfile, kg: KnowledgeGraph | None) -> int | None:
        if not kg:
            return None
        profile.industry = kg.type
        if kg.attributes:
            listed = "; ".join(f"{k}: {v}" for k, v in kg.attributes.items())
            item = self._store.add_knowledge_graph(kg, f"Facts listed in Google's knowledge panel for {kg.title}", text=listed)
            if item:
                for key, value in kg.attributes.items():
                    profile.attributes[key] = CompanyFact(text=value, evidence_ids=[item.id])
        founded = kg.attributes.get("founded", "")
        year = _YEAR.search(founded)
        return int(year.group(0)) if year else None

    def _descriptive_hits(self, hits: list[SearchHit]) -> list[SearchHit]:
        """Results that can describe the business, best first: the employer's own about/company pages,
        then other official pages, then everything else that is descriptive."""
        def score(hit: SearchHit) -> int:
            official = registered_domain(hit.url) in self._store.company_domains
            return (
                (2 if official else 0)
                + (2 if _ABOUT_URL.search(hit.url) else 0)
                + (2 if _PROFILE_URL.search(hit.url) else 0)
                - (4 if _PROMO.search(hit.snippet) else 0)  # a storefront's ad copy is not a description of the business
            )

        return sorted((h for h in hits if is_descriptive(h)), key=score, reverse=True)  # stable within equal scores

    def _add_product_facts(self, profile: CompanyProfile, hits: list[SearchHit]) -> None:
        """Snippets describing the company, verbatim, best first (about/profile pages, then other official pages)."""
        for hit in self._descriptive_hits(hits)[:_MAX_PRODUCT_FACTS]:
            item = self._store.add_hit(hit, f"Description of {profile.name}'s business found in search results")
            profile.products.append(CompanyFact(text=truncate(hit.snippet, 300), evidence_ids=[item.id]))

    def _build_overview(self, profile: CompanyProfile, hits: list[SearchHit], kg: KnowledgeGraph | None) -> None:
        if kg and kg.description:
            item = self._store.add_knowledge_graph(kg, f"Overview of {kg.title}", text=kg.description)
            if item:
                profile.overview, profile.overview_source = kg.description, "knowledge_graph"
                profile.overview_evidence_ids = [item.id]
                return
        if self._llm and profile.products:
            if self._llm_overview(profile):
                return
        if profile.products:
            fact = profile.products[0]
            profile.overview, profile.overview_source = fact.text, "search_snippet"
            profile.overview_evidence_ids = list(fact.evidence_ids)

    def _llm_overview(self, profile: CompanyProfile) -> bool:
        excerpts = [(eid, self._store.get(eid)) for fact in profile.products for eid in fact.evidence_ids]
        # Marketing copy must not reach the model: it would restate "unbeatable prices" as if it were a fact.
        lines = [f"[{eid}] {item.evidence_text}" for eid, item in excerpts[:_MAX_LLM_EXCERPTS] if item and not _PROMO.search(item.evidence_text)]
        if not lines:
            return False
        try:
            text = self._llm.complete(_OVERVIEW_SYSTEM, f"Company: {profile.name}\nExcerpts:\n" + "\n".join(lines) + "\n\nWrite 2-3 sentences.")  # type: ignore[union-attr]
        except ScoutLensError as exc:
            logger.info("LLM overview skipped: %s", exc)
            return False
        name = profile.name
        # Every sentence must be supported by the excerpt it cites AND be about the company itself; an
        # otherwise well-formed sentence about a playlist or a login page is dropped.
        checked = validate_prose(
            text, self._store, min_grounding=_MIN_GROUNDING, ignore_words=set(normalize_company(name).split()),
            keep_if=lambda sentence: mentions_company(sentence, name) or bool(_ABOUT_COMPANY_START.match(sentence)),
        )
        if checked.is_empty or not is_neutral(checked.text) or not mentions_company(checked.text, name):
            return False
        profile.overview, profile.overview_source = checked.text, "llm"
        profile.overview_evidence_ids = checked.evidence_ids
        return True
