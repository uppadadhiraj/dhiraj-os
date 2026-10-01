"""Google News via SerpApi: recent coverage of the organization."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from models.search import NewsItem, SearchQuery
from services.serpapi.client import SerpApiClient
from services.serpapi.parsing import as_dict, as_list, build_all, clean_text

# SerpApi's google_news engine documents dates like "01/02/2026, 10:30 PM, +0700 +07" and also returns
# an ``iso_date`` ("2026-01-02T15:30:13Z"), which is preferred.
_DOC_DATE = re.compile(r"^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2} [AP]M), ([+-]\d{4})")
_DATE_FORMATS = ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d")


def parse_iso_date(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def parse_news_date(text: str | None) -> datetime | None:
    """Parse an absolute date. Relative dates ("3 days ago") are kept as text, never guessed."""
    if not text:
        return None
    match = _DOC_DATE.match(text)
    if match:
        try:
            return datetime.strptime(", ".join(match.groups()), "%m/%d/%Y, %I:%M %p, %z")
        except ValueError:
            return None
    for fmt in _DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _news_item(search_id: str, item: dict[str, Any]) -> NewsItem:
    source = item.get("source")
    publisher = clean_text(source.get("name")) if isinstance(source, dict) else clean_text(source)
    date_text = clean_text(item.get("date"))
    return NewsItem(
        search_id=search_id,
        title=clean_text(item.get("title")) or "",
        url=clean_text(item.get("link")) or "",
        publisher=publisher,
        date_text=date_text,
        published_at=parse_iso_date(clean_text(item.get("iso_date"))) or parse_news_date(date_text),
        snippet=clean_text(item.get("snippet")) or "",
    )


def _flatten(results: list[Any]) -> list[dict[str, Any]]:
    """Google News groups related articles into ``stories``; surface each one as its own item."""
    flat: list[dict[str, Any]] = []
    for item in results:
        item = as_dict(item)
        stories = as_list(item.get("stories"))
        if stories:
            flat.extend(as_dict(story) for story in stories)
        else:
            flat.append(item)
    return flat


def parse_news(data: dict[str, Any], search_id: str) -> list[NewsItem]:
    items = build_all(_flatten(as_list(data.get("news_results"))), lambda i: _news_item(search_id, i))
    return [item for item in items if item.title]


def fetch_news(client: SerpApiClient, query: SearchQuery, *, refresh: bool = False) -> list[NewsItem]:
    response = client.search(query, refresh=refresh)
    return parse_news(response.data, response.search_id)
