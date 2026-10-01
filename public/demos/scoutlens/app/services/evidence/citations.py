"""Citation validation for LLM-written prose: NO SOURCE = NO FACT, enforced in code.

The LLM is shown numbered evidence items and must end each sentence with ``[E#]`` markers. Any
sentence with no marker, or with a marker that is not in the evidence store, is dropped.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from services.evidence.store import EvidenceStore

_CITATION = re.compile(r"\[(E\d+)\]")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(])")
# "X. [E1] Y" -> "X [E1]. Y": models cite before or after the full stop; normalise to "before".
_TRAILING_CITATIONS = re.compile(r"([.!?])\s*((?:\[E\d+\]\s*)+)")


def _sentences(text: str) -> list[str]:
    text = _TRAILING_CITATIONS.sub(lambda m: f" {m.group(2).strip()}{m.group(1)} ", " ".join(text.split()))
    return [s.strip() for s in _SENTENCE_SPLIT.split(" ".join(text.split())) if s.strip()]


@dataclass
class ValidatedProse:
    text: str  # kept sentences, citations preserved
    evidence_ids: list[str]  # distinct ids cited by the kept sentences, in order
    dropped: int  # sentences removed for missing/invalid citations

    @property
    def is_empty(self) -> bool:
        return not self.text


def cited_ids(text: str) -> list[str]:
    return list(dict.fromkeys(_CITATION.findall(text)))


def strip_citations(text: str) -> str:
    return re.sub(r"\s*\[E\d+\]", "", text).strip()


_WORD = re.compile(r"[a-z]{4,}")
_STOPWORDS = {
    "that", "with", "this", "from", "have", "which", "their", "also", "been", "were", "will", "into", "more",
    "than", "they", "them", "such", "these", "those", "while", "about", "other", "company", "including", "various",
    "offers", "provides", "specializes", "developing", "focuses", "works", "helps", "based", "known",
}


def _stem(word: str) -> str:
    return word[:-1] if word.endswith("s") and len(word) > 4 else word


def grounding_score(sentence: str, evidence_text: str, ignore: set[str] = frozenset()) -> float:
    """Share of the sentence's content words that occur in its cited evidence.

    A citation id proves the source exists, not that the sentence is *supported* by it. Requiring most
    content words to appear in the cited excerpt catches invented details that carry a valid citation.
    Deliberately lexical (no model): cheap, deterministic and easy to reason about.
    """
    words = {_stem(w) for w in _WORD.findall(strip_citations(sentence).lower())} - _STOPWORDS - ignore
    if not words:
        return 1.0
    available = {_stem(w) for w in _WORD.findall(evidence_text.lower())}
    return len(words & available) / len(words)


def validate_prose(
    text: str,
    store: EvidenceStore,
    *,
    min_grounding: float = 0.0,
    keep_if: Callable[[str], bool] | None = None,
    ignore_words: set[str] = frozenset(),
) -> ValidatedProse:
    """Keep only sentences that (1) cite evidence that exists, (2) are lexically supported by the
    cited excerpts when ``min_grounding`` is set, and (3) satisfy ``keep_if`` (e.g. "is about the company")."""
    kept: list[str] = []
    ids: list[str] = []
    dropped = 0
    for sentence in _sentences(text):
        cited = cited_ids(sentence)
        valid = bool(cited) and len(store.existing_ids(cited)) == len(cited)
        if valid and min_grounding > 0:
            evidence_text = " ".join(item.evidence_text for i in cited if (item := store.get(i)))
            valid = grounding_score(sentence, evidence_text, ignore_words) >= min_grounding
        if valid and keep_if is not None:
            valid = keep_if(strip_citations(sentence))
        if valid:
            kept.append(sentence)
            ids += [i for i in cited if i not in ids]
        else:
            dropped += 1
    return ValidatedProse(text=" ".join(kept), evidence_ids=ids, dropped=dropped)
