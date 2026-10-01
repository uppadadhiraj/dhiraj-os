"""Cross-checks: is an important claim supported by more than one independent signal?

Outcomes are neutral: ``corroborated``, ``single_source``, ``conflicting`` ("conflicting information"),
or ``insufficient``. A cross-check never says a claim is false. Corroborated claims get a one-level
confidence upgrade for the evidence involved.
"""
from __future__ import annotations

from models.company import CompanyProfile
from models.opportunity import OpportunityProfile
from models.report import CrossCheck, HiringSignal
from services.evidence.store import EvidenceStore
from utils.domains import registered_domain, same_site


def _website_check(company: CompanyProfile, opp: OpportunityProfile, store: EvidenceStore) -> CrossCheck | None:
    if not company.website:
        return None
    signals: list[str] = []
    if company.website_basis and company.website_basis.startswith("Listed"):
        signals.append("Google's knowledge panel lists it")
    listing_url = opp.application_url or opp.source_url
    if listing_url and same_site(listing_url, company.website):
        signals.append("the listing itself is hosted on it")
    domain = registered_domain(company.website)
    hits = [e for e in store.items if e.source_type == "company_site" and registered_domain(e.source_url) == domain]
    if hits:
        signals.append(f"{len(hits)} search result(s) come from it")
    ids = list(dict.fromkeys([*company.website_evidence_ids, *(e.id for e in hits)]))
    detail = f"{company.website}: " + ("; ".join(signals) + "." if signals else f"{company.website_basis or 'basis not recorded'}.")
    if len(signals) >= 2:
        store.upgrade_confidence(company.website_evidence_ids)
        return CrossCheck(claim=f"Official website is {company.website}", status="corroborated", detail=detail, evidence_ids=ids)
    return CrossCheck(claim=f"Official website is {company.website}", status="single_source", detail=detail, evidence_ids=ids)


def _funding_check(company: CompanyProfile, store: EvidenceStore) -> CrossCheck | None:
    ids = [i for fact in company.funding for i in fact.evidence_ids]
    items = [store.get(i) for i in ids]
    domains = {registered_domain(e.source_url) for e in items if e}
    if not domains:
        return None
    if len(domains) >= 2:
        store.upgrade_confidence(ids)
        return CrossCheck(
            claim=f"Funding or investment coverage for {company.name}", status="corroborated",
            detail=f"Mentioned by {len(domains)} independent sources.", evidence_ids=ids,
        )
    return CrossCheck(
        claim=f"Funding or investment coverage for {company.name}", status="single_source",
        detail="Mentioned by one source only; unverified information that is worth confirming.", evidence_ids=ids,
    )


def _listing_check(opp: OpportunityProfile, hiring: HiringSignal | None, listing_evidence_id: str | None, store: EvidenceStore) -> CrossCheck | None:
    if hiring is None:
        return None
    listing_ids = [listing_evidence_id] if listing_evidence_id else []
    found = [c for c in hiring.comparisons if c.kind == "listing" and "also appears" in c.fact]
    found_ids = found[0].evidence_ids if found else []
    if opp.extraction_method == "manual":
        return CrossCheck(
            claim="The listing is publicly posted", status="insufficient",
            detail="The description was pasted manually, so its presence on the web could not be checked directly."
            + (" A matching listing was found in Google Jobs." if hiring.original_found else ""),
            evidence_ids=found_ids,
        )
    if hiring.original_found:
        if listing_evidence_id:
            store.upgrade_confidence(listing_ids)
        return CrossCheck(
            claim="The listing is publicly posted", status="corroborated",
            detail="The supplied page was read directly and the same posting also appears in Google Jobs.",
            evidence_ids=[*listing_ids, *found_ids],
        )
    return CrossCheck(
        claim="The listing is publicly posted", status="single_source",
        detail="The supplied page was read directly, but the listing was not seen in Google Jobs results; "
        "this may only reflect search coverage.",
        evidence_ids=listing_ids,
    )


def _experience_check(hiring: HiringSignal | None) -> CrossCheck | None:
    comparison = next((c for c in (hiring.comparisons if hiring else []) if c.kind == "experience"), None)
    if comparison is None:
        return None
    consistent = "same as this one" in comparison.fact
    return CrossCheck(
        claim="Experience requirement is consistent with the employer's comparable listings",
        status="corroborated" if consistent else "conflicting",
        detail=comparison.fact if consistent else f"Conflicting information: {comparison.fact}",
        evidence_ids=comparison.evidence_ids,
    )


def run_crosschecks(
    opp: OpportunityProfile,
    company: CompanyProfile | None,
    hiring: HiringSignal | None,
    store: EvidenceStore,
    *,
    listing_evidence_id: str | None = None,
) -> list[CrossCheck]:
    checks = [
        _website_check(company, opp, store) if company else None,
        _funding_check(company, store) if company else None,
        _listing_check(opp, hiring, listing_evidence_id, store),
        _experience_check(hiring),
    ]
    return [c for c in checks if c is not None]
