"""Source-quality tiers (transparent, rule-based; unknown sources default to the lowest tier).

Tier 1  official company site/listing, government, university, primary research
Tier 2  established news organisations and major industry publications, Google knowledge panels
Tier 3  aggregators, forums, user-generated or community-edited content, unclassified web sources
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from utils.domains import host_of, registered_domain

_GOV_SUFFIXES = (".gov", ".gov.in", ".nic.in", ".gov.uk", ".gov.au", ".mil", ".europa.eu")
_EDU_SUFFIXES = (".edu", ".ac.in", ".edu.in", ".ac.uk", ".edu.au")
_RESEARCH_DOMAINS = {
    "arxiv.org", "doi.org", "ieee.org", "acm.org", "nature.com", "sciencedirect.com", "springer.com",
    "semanticscholar.org", "nih.gov", "jstor.org",
}
_NEWS_DOMAINS = {
    "reuters.com", "bloomberg.com", "economictimes.indiatimes.com", "livemint.com", "business-standard.com",
    "thehindu.com", "thehindubusinessline.com", "hindustantimes.com", "timesofindia.indiatimes.com",
    "techcrunch.com", "theverge.com", "wired.com", "forbes.com", "ft.com", "wsj.com", "cnbc.com", "bbc.com",
    "bbc.co.uk", "nytimes.com", "moneycontrol.com", "inc42.com", "yourstory.com", "entrackr.com",
    "zdnet.com", "arstechnica.com", "venturebeat.com", "businessinsider.com", "indianexpress.com",
    "ndtv.com", "indiatoday.in", "theprint.in", "financialexpress.com", "medianama.com", "theguardian.com",
    "apnews.com", "axios.com", "fortune.com", "techradar.com", "siliconangle.com", "theinformation.com",
}
_NEWS_PUBLISHERS = re.compile(
    r"\b(reuters|bloomberg|economic times|livemint|\bmint\b|business standard|the hindu|hindustan times|"
    r"times of india|techcrunch|the verge|wired|forbes|financial times|wall street journal|cnbc|bbc|"
    r"new york times|moneycontrol|inc42|yourstory|entrackr|zdnet|ars technica|venturebeat|business insider|"
    r"indian express|ndtv|india today|theprint|financial express|medianama|the guardian|associated press|"
    r"axios|fortune)\b",
    re.I,
)
_TIER3_LABELS: dict[str, str] = {
    "linkedin.com": "Job/professional aggregator",
    "indeed.com": "Job aggregator",
    "glassdoor.com": "Job aggregator",
    "glassdoor.co.in": "Job aggregator",
    "naukri.com": "Job aggregator",
    "internshala.com": "Job aggregator",
    "monster.com": "Job aggregator",
    "ziprecruiter.com": "Job aggregator",
    "foundit.in": "Job aggregator",
    "shine.com": "Job aggregator",
    "simplyhired.com": "Job aggregator",
    "jooble.org": "Job aggregator",
    "talent.com": "Job aggregator",
    "careerjet.co.in": "Job aggregator",
    "adzuna.in": "Job aggregator",
    "jobrapido.com": "Job aggregator",
    "learn4good.com": "Job aggregator",
    "hirist.tech": "Job aggregator",
    "cutshort.io": "Job aggregator",
    "instahyre.com": "Job aggregator",
    "unstop.com": "Job aggregator",
    "wellfound.com": "Job aggregator",
    "ambitionbox.com": "Employee-review aggregator",
    "reddit.com": "Forum / user-generated",
    "quora.com": "Forum / user-generated",
    "medium.com": "User-generated",
    "substack.com": "User-generated",
    "facebook.com": "Social media",
    "instagram.com": "Social media",
    "twitter.com": "Social media",
    "x.com": "Social media",
    "youtube.com": "Social media",
    "wikipedia.org": "Reference (community-edited)",
    "wikidata.org": "Reference (community-edited)",
    "crunchbase.com": "Business-data aggregator",
    "tracxn.com": "Business-data aggregator",
    "pitchbook.com": "Business-data aggregator",
    "zaubacorp.com": "Business-data aggregator",
}
# Applicant-tracking hosts where a path/subdomain slug identifies the employer.
_ATS_HOSTS = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com", "jobvite.com",
    "bamboohr.com", "myworkdayjobs.com", "recruitee.com", "breezy.hr", "teamtailor.com",
)


@dataclass(frozen=True)
class SourceQuality:
    tier: int
    label: str


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _is_ats_for_company(url: str, company_name: str | None) -> bool:
    host = host_of(url)
    if not company_name or not any(host == h or host.endswith("." + h) for h in _ATS_HOSTS):
        return False
    slug = _slug(company_name)
    return bool(slug) and slug in _slug(url.split("://", 1)[-1])


def classify_source(
    url: str,
    *,
    publisher: str | None = None,
    kind: str = "web",
    company_domains: frozenset[str] | set[str] = frozenset(),
    company_name: str | None = None,
) -> SourceQuality:
    """Classify a retrieved source. ``company_domains`` are registered domains known to be the employer's."""
    host = host_of(url)
    domain = registered_domain(url)

    if domain in company_domains:
        return SourceQuality(1, "Official company website")
    if _is_ats_for_company(url, company_name):
        return SourceQuality(1, "Official job listing (employer's ATS)")
    if host.endswith(_GOV_SUFFIXES):
        return SourceQuality(1, "Government source")
    if host.endswith(_EDU_SUFFIXES):
        return SourceQuality(1, "University")
    if domain in _RESEARCH_DOMAINS:
        return SourceQuality(1, "Primary research")
    if domain in _TIER3_LABELS:
        return SourceQuality(3, _TIER3_LABELS[domain])
    if domain in _NEWS_DOMAINS or (kind == "news" and publisher and _NEWS_PUBLISHERS.search(publisher)):
        return SourceQuality(2, "Established news / industry publication")
    if kind == "knowledge_graph":
        return SourceQuality(2, "Google knowledge panel")
    return SourceQuality(3, "Other web source (unclassified)")


def assess_confidence(tier: int, relevance: str) -> str:
    """Confidence in a single source before any cross-checking: reliability capped by relevance."""
    base = {1: "high", 2: "medium", 3: "low"}[tier]
    if relevance == "low":
        return "low"
    if relevance == "medium" and base == "high":
        return "medium"
    return base
