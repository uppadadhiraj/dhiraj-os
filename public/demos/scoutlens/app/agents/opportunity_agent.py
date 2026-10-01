"""Opportunity Agent: turn a URL (or pasted text) into an :class:`OpportunityProfile`."""
from __future__ import annotations

import logging

from models.opportunity import OpportunityProfile
from services.scraping.extractor import extract_from_html, extract_from_text
from services.scraping.fetcher import PageFetcher

logger = logging.getLogger(__name__)


def read_opportunity_from_url(url: str, fetcher: PageFetcher | None = None) -> OpportunityProfile:
    """Fetch ``url`` politely and extract the listing.

    Raises :class:`~utils.errors.InvalidURLError` for unusable URLs and
    :class:`~utils.errors.ExtractionError` when the page cannot be read; both carry a
    user-facing message that suggests pasting the description manually.
    """
    page = (fetcher or PageFetcher()).fetch(url)
    profile = extract_from_html(page.content, page.url)
    if page.truncated:
        profile.notes.append("The page was very large and was read only in part.")
    logger.info(
        "Extracted opportunity via %s (company=%s, role=%s)",
        profile.extraction_method, bool(profile.company_name), bool(profile.role_title),
    )
    return profile


def read_opportunity_from_text(
    text: str,
    *,
    company_name: str | None = None,
    role_title: str | None = None,
    location: str | None = None,
    source_url: str | None = None,
) -> OpportunityProfile:
    """Manual fallback: analyse a job description the user pasted."""
    return extract_from_text(
        text, source_url=source_url, company_name=company_name, role_title=role_title, location=location
    )
