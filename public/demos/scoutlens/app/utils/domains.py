"""Hostname helpers (no external public-suffix dependency; covers the common ccTLD patterns)."""
from __future__ import annotations

from urllib.parse import urlparse

_SECOND_LEVEL = {"co", "com", "org", "net", "ac", "gov", "edu", "nic"}

# Generic job boards: the host says nothing about who the employer is.
JOB_BOARDS = {
    "linkedin.com", "indeed.com", "glassdoor.com", "glassdoor.co.in", "naukri.com", "internshala.com",
    "wellfound.com", "monster.com", "ziprecruiter.com", "foundit.in", "shine.com", "simplyhired.com",
    "angel.co", "hirist.tech", "cutshort.io", "instahyre.com", "unstop.com", "google.com", "in.indeed.com",
}
# Applicant-tracking systems where the *path* (first segment) names the employer.
ATS_PATH_HOSTS = {
    "boards.greenhouse.io", "job-boards.greenhouse.io", "boards.eu.greenhouse.io", "jobs.lever.co",
    "jobs.ashbyhq.com", "apply.workable.com", "jobs.smartrecruiters.com", "careers.smartrecruiters.com",
    "jobs.jobvite.com",
}
# ATS hosts where the *subdomain* names the employer.
ATS_SUBDOMAIN_SUFFIXES = (
    ".workable.com", ".bamboohr.com", ".myworkdayjobs.com", ".recruitee.com", ".breezy.hr", ".teamtailor.com",
)


def is_job_board_or_ats(url_or_host: str) -> bool:
    """True when the host is a shared job platform rather than the employer's own site."""
    host = host_of(url_or_host)
    return (
        any(host == b or host.endswith("." + b) for b in JOB_BOARDS)
        or host in ATS_PATH_HOSTS
        or host.endswith(ATS_SUBDOMAIN_SUFFIXES)
    )


def host_of(url_or_host: str) -> str:
    """Lower-cased hostname of a URL (or of a bare host), without port or ``www.``."""
    value = (url_or_host or "").strip().lower()
    host = urlparse(value if "://" in value else f"//{value}").hostname or ""
    return host.removeprefix("www.")


def registered_domain(url_or_host: str) -> str:
    """``careers.contoso.co.in`` -> ``contoso.co.in``; ``a.b.example.com`` -> ``example.com``."""
    host = host_of(url_or_host)
    labels = [label for label in host.split(".") if label]
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in _SECOND_LEVEL:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:]) if len(labels) >= 2 else host


def origin_of(url: str) -> str:
    """``https://www.x.com/a/b?c`` -> ``https://www.x.com/`` (scheme and host as given, path dropped)."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/" if parsed.scheme and parsed.netloc else url


def same_site(url_a: str, url_b: str) -> bool:
    a, b = registered_domain(url_a), registered_domain(url_b)
    return bool(a) and a == b
