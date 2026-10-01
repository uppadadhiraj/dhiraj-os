"""Google Search via SerpApi: organic results plus the knowledge graph (company identity)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from models.search import KnowledgeGraph, SearchHit, SearchQuery
from services.serpapi.client import SerpApiClient
from services.serpapi.parsing import as_dict, as_list, build_all, clean_text

_KG_SKIP_KEYS = {
    "title", "type", "description", "website", "source", "kgmid", "knowledge_graph_search_link",
    "serpapi_knowledge_graph_search_link", "header_images", "image", "thumbnail", "entity_type",
    # volatile or contact-detail attributes that are noise as "company facts"
    "sales", "customer_service", "phone", "stock_price", "hours", "reviews", "review_count",
}
_KG_MAX_VALUE_LEN = 300


@dataclass
class GoogleResults:
    search_id: str
    hits: list[SearchHit] = field(default_factory=list)
    knowledge_graph: KnowledgeGraph | None = None


def _hit(search_id: str, item: dict[str, Any]) -> SearchHit:
    return SearchHit(
        search_id=search_id,
        position=item.get("position") if isinstance(item.get("position"), int) else None,
        title=clean_text(item.get("title")) or "",
        url=clean_text(item.get("link")) or "",
        snippet=clean_text(item.get("snippet")) or "",
        displayed_link=clean_text(item.get("displayed_link")),
        date=clean_text(item.get("date")),
    )


def parse_knowledge_graph(data: dict[str, Any], search_id: str) -> KnowledgeGraph | None:
    kg = as_dict(data.get("knowledge_graph"))
    title = clean_text(kg.get("title"))
    if not title:
        return None
    source = as_dict(kg.get("source"))
    attributes = {
        key.replace("_", " "): value
        for key, raw in kg.items()
        if key not in _KG_SKIP_KEYS
        and (value := clean_text(raw))
        and len(value) <= _KG_MAX_VALUE_LEN
    }
    try:
        return KnowledgeGraph(
            search_id=search_id,
            title=title,
            type=clean_text(kg.get("type")),
            description=clean_text(kg.get("description")),
            website=clean_text(kg.get("website")),
            source_name=clean_text(source.get("name")),
            source_url=clean_text(source.get("link")),
            attributes=attributes,
        )
    except ValueError:
        # An invalid website/source URL should not discard the rest of the panel.
        return KnowledgeGraph(
            search_id=search_id,
            title=title,
            type=clean_text(kg.get("type")),
            description=clean_text(kg.get("description")),
            attributes=attributes,
        )


def parse_google(data: dict[str, Any], search_id: str) -> GoogleResults:
    hits = build_all(as_list(data.get("organic_results")), lambda item: _hit(search_id, item))
    return GoogleResults(
        search_id=search_id, hits=hits, knowledge_graph=parse_knowledge_graph(data, search_id)
    )


def fetch_google(client: SerpApiClient, query: SearchQuery, *, refresh: bool = False) -> GoogleResults:
    response = client.search(query, refresh=refresh)
    return parse_google(response.data, response.search_id)
