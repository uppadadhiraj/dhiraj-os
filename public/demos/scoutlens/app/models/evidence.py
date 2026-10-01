"""Evidence: every fact shown to the user traces back to one of these, and each one traces back
to a result that SerpApi actually returned. Only :class:`services.evidence.store.EvidenceStore`
creates them; the LLM can reference ids but can never mint an item."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.common import HttpUrlStr, utcnow

SourceType = Literal["company_site", "job", "news", "knowledge_graph", "web"]
Level = Literal["high", "medium", "low"]
Stance = Literal["supporting", "contradicting", "neutral"]


class EvidenceItem(BaseModel):
    id: str
    claim: str
    source_title: str
    source_url: HttpUrlStr
    source_type: SourceType
    publisher: str | None = None
    date: str | None = None
    evidence_text: str = Field(description="Verbatim excerpt from the retrieved result")
    relevance: Level
    confidence: Level
    supporting_or_contradicting: Stance = "supporting"

    tier: Literal[1, 2, 3]
    tier_label: str
    search_id: str = Field(description="The executed search (SearchRecord.id) that retrieved this")
    retrieved_at: datetime = Field(default_factory=utcnow)
