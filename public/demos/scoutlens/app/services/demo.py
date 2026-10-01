"""Demo mode: a deterministic, clearly-synthetic investigation that works with no API key.

Everything here is FICTIONAL: the employer, its pages (``.example`` is a reserved TLD), its listings
and its news. The recorded responses have the same shape as SerpApi's and are replayed through the
*real* client, parsers, analysis and evidence engine; only the network call is replaced. The UI labels
every demo report "Demo data": nothing here is presented as a live search.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from pydantic import SecretStr

from config import Settings
from models.opportunity import OpportunityProfile
from models.resume import ResumeProfile
from services.resume.parser import parse_resume_text
from services.scraping.extractor import extract_from_html
from services.serpapi.client import SerpApiClient

COMPANY = "Lumenpath Labs"
SITE = "https://www.lumenpath.example"
LISTING_URL = f"{SITE}/careers/software-engineer-intern"
ROLE = "Software Engineer Intern"
DEMO_NOTICE = (
    "Demo data: a fictional company and recorded, synthetic search responses replayed through the real "
    "analysis pipeline. No live search was made."
)

# (title, location, skills mentioned, experience phrase, remote?, salary, applied-via-official-site?)
_COMPANY_LISTINGS: tuple[tuple[str, str, tuple[str, ...], str, bool, str | None, bool], ...] = (
    ("Backend Engineer", "Bengaluru, Karnataka, India", ("Python", "FastAPI", "SQL", "AWS", "Docker", "Git", "REST APIs"), "3-5 years", False, "₹14–20 LPA", True),
    ("Senior Backend Engineer", "Bengaluru, Karnataka, India", ("Python", "FastAPI", "AWS", "Docker", "Kubernetes", "SQL", "REST APIs"), "5+ years", False, "₹24–34 LPA", True),
    ("Data Engineer", "Pune, Maharashtra, India", ("Python", "SQL", "AWS", "Airflow"), "2-4 years", False, "₹12–18 LPA", True),
    ("Platform Engineer", "Bengaluru, Karnataka, India", ("Python", "Docker", "Kubernetes", "AWS", "Terraform", "Git"), "3+ years", False, "₹18–26 LPA", True),
    ("DevOps Engineer", "Pune, Maharashtra, India", ("Docker", "Kubernetes", "AWS", "Terraform", "Linux", "Python"), "3-5 years", False, None, False),
    ("Machine Learning Engineer", "Bengaluru, Karnataka, India", ("Python", "Machine Learning", "SQL", "AWS"), "2-4 years", False, None, False),
    ("Frontend Engineer", "Bengaluru, Karnataka, India", ("React", "JavaScript", "Git", "REST APIs"), "2-4 years", False, None, True),
    ("QA Engineer", "Pune, Maharashtra, India", ("Python", "SQL", "Git", "Selenium"), "1-3 years", False, None, False),
    ("Data Analyst Intern", "Pune, Maharashtra, India", ("Python", "SQL", "Excel", "Tableau"), "1-3 years", False, None, True),
    ("Machine Learning Intern", "Bengaluru, Karnataka, India", ("Python", "Machine Learning", "Git", "SQL"), "1-3 years", False, None, False),
    ("Platform Engineering Intern", "Pune, Maharashtra, India", ("Python", "Docker", "Git", "Linux"), "2-4 years", False, None, True),
    ("Software Engineer", "Remote", ("Python", "FastAPI", "SQL", "AWS", "REST APIs", "Git"), "1-3 years", True, "₹10–15 LPA", True),
    ("Software Engineer II", "Remote", ("Java", "Spring Boot", "SQL", "AWS", "REST APIs"), "3+ years", True, "₹16–24 LPA", False),
    ("Solutions Engineer", "Bengaluru, Karnataka, India", ("Python", "SQL", "REST APIs", "Git"), "2-4 years", False, None, False),
    ("Security Engineer", "Pune, Maharashtra, India", ("Python", "AWS", "Linux", "Docker", "Kubernetes"), "4+ years", False, None, False),
    ("Data Scientist", "Remote", ("Python", "SQL", "Machine Learning", "Git"), "2-4 years", True, "₹15–22 LPA", True),
    ("Technical Support Engineer", "Bengaluru, Karnataka, India", ("SQL", "Linux", "Git", "REST APIs"), "1-3 years", False, None, False),
    ("Site Reliability Engineer", "Remote", ("Python", "AWS", "Kubernetes", "Docker", "Terraform", "Git"), "4+ years", True, None, True),
)

# (skill, count within the 61-listing market sample, window start): exact counts by construction
_MARKET_SIZE = 61
_MARKET_SKILLS: tuple[tuple[str, int, int], ...] = (
    ("Python", 44, 7), ("Git", 35, 20), ("SQL", 30, 3), ("REST APIs", 26, 40), ("Docker", 23, 0), ("React", 20, 33),
    ("AWS", 18, 12), ("Java", 15, 50), ("Linux", 12, 25), ("TypeScript", 10, 45), ("Kubernetes", 9, 2), ("MongoDB", 8, 30),
)
_MARKET_COMPANIES = (
    "Orbitex", "Quantiva", "Brightloom", "Cindercore", "Helixware", "Mintgrid", "Nimbusly", "Ostrava Tech", "Pixelforge",
    "Rivetworks", "Stackpine", "Tessera Labs", "Umbrago", "Vectorly", "Wavecrest", "Xylo Systems", "Yarrowsoft", "Zenithly",
)
_MARKET_TITLES = ("Software Engineer Intern", "Software Development Intern", "Backend Engineer Intern", "Software Engineer Intern (Remote)")

RESUME_TEXT = """ASHA VERMA
asha.verma@example.com | github.com/ashaverma-demo

Summary
Final-year computer science student interested in backend development.

Education
B.Tech in Computer Science, Example Institute of Technology, 2022 - 2026
CGPA: 8.4/10

Technical Skills
Languages: Python, SQL, JavaScript
Frameworks: FastAPI, Flask, React
Databases: Postgres, MongoDB
Tools: Git

Projects
Expense Tracker | Python, Flask
• Built a REST API with Flask and a PostgreSQL database
• Added unit tests with pytest
Campus Events App | React, FastAPI
• Built the frontend in React and the backend in FastAPI

Experience
Backend Intern - Acme Analytics (Jun 2025 - Aug 2025)
• Built internal reporting tools in Python and wrote SQL reports
• Automated data checks with scheduled scripts

Certifications
• Machine Learning by Andrew Ng (Coursera)

Achievements
• Finalist, college hackathon 2025
"""


def _shift(moment: datetime, days: int) -> str:
    return (moment + timedelta(days=days)).date().isoformat()


def listing_page_html(now: datetime) -> str:
    """The fictional listing page: JSON-LD JobPosting whose description omits Docker/AWS on purpose."""
    description = (
        "<p>Join the platform team at Lumenpath Labs and help retailers plan routes and inventory.</p>"
        "<h3>Responsibilities</h3><ul><li>Build and test internal tools and REST APIs in Python</li>"
        "<li>Write SQL queries for operational reports</li></ul>"
        "<h3>Requirements</h3><ul><li>Pursuing a B.Tech or equivalent in Computer Science</li>"
        "<li>0-2 years of experience; freshers are eligible</li><li>Working knowledge of Python, SQL and REST APIs</li></ul>"
        "<h3>Nice to have</h3><ul><li>Git and Linux basics</li><li>Exposure to machine learning</li></ul>"
        "<p>This is an in-office role: work from office at our Bengaluru campus.</p>"
    )
    posting = {
        "@context": "https://schema.org", "@type": "JobPosting", "title": ROLE,
        "hiringOrganization": {"@type": "Organization", "name": COMPANY, "sameAs": SITE},
        "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": "Bengaluru", "addressRegion": "Karnataka", "addressCountry": "IN"}},
        "employmentType": "INTERN", "datePosted": _shift(now, -60), "validThrough": _shift(now, 12),
        "url": LISTING_URL, "description": description.replace("<", "&lt;").replace(">", "&gt;"),
    }
    return (
        f"<html><head><title>{ROLE} | {COMPANY} Careers</title>"
        f'<script type="application/ld+json">{json.dumps(posting)}</script></head>'
        f"<body><main><h1>{ROLE}</h1></main></body></html>"
    )


def demo_opportunity(now: datetime) -> OpportunityProfile:
    """The listing, extracted by the real extractor from the synthetic page."""
    return extract_from_html(listing_page_html(now), LISTING_URL)


def demo_resume() -> ResumeProfile:
    return parse_resume_text(RESUME_TEXT)


# ---------------------------------------------------------------- recorded responses

def _job(job_id: str, title: str, company: str, location: str, description: str, *, via: str, apply_url: str | None,
         remote: bool = False, salary: str | None = None, qualifications: list[str] | None = None) -> dict[str, Any]:
    ext: dict[str, Any] = {"schedule_type": "Internship" if "intern" in title.lower() else "Full-time", "posted_at": "5 days ago"}
    if remote:
        ext["work_from_home"] = True
    if salary:
        ext["salary"] = salary
    job: dict[str, Any] = {
        "title": title, "company_name": company, "location": location, "via": f"via {via}", "description": description,
        "job_id": job_id, "share_link": f"https://www.google.com/search?q=demo&htidocid={job_id}", "detected_extensions": ext,
    }
    if qualifications:
        job["job_highlights"] = [{"title": "Qualifications", "items": qualifications}]
    if apply_url:
        job["apply_options"] = [{"title": f"Apply on {via}", "link": apply_url}]
    return job


def _company_jobs() -> list[dict[str, Any]]:
    jobs = []
    for i, (title, location, skills, experience, remote, salary, official) in enumerate(_COMPANY_LISTINGS, start=1):
        text = f"{title} at {COMPANY}. You will work with {', '.join(skills)}. Requires {experience} of experience."
        jobs.append(_job(
            f"lp-{i}", title, COMPANY, location, text,
            via="Lumenpath Careers" if official else "LinkedIn",
            apply_url=f"{SITE}/careers/{i}" if official else f"https://www.linkedin.example/jobs/view/{1000 + i}",
            remote=remote, salary=salary,
        ))
    original = _job(
        "lp-orig", ROLE, COMPANY, "Bengaluru, Karnataka, India",
        f"{ROLE} at {COMPANY}. Python, SQL and REST APIs. Freshers are eligible.", via="LinkedIn",
        apply_url="https://www.linkedin.example/jobs/view/999",
    )
    return [original, *jobs]


def _market_jobs() -> list[dict[str, Any]]:
    jobs = []
    for i in range(_MARKET_SIZE):
        skills = [name for name, count, start in _MARKET_SKILLS if (i - start) % _MARKET_SIZE < count]
        company = f"{_MARKET_COMPANIES[i % len(_MARKET_COMPANIES)]} {i // len(_MARKET_COMPANIES) + 1}"
        jobs.append(_job(
            f"mk-{i}", _MARKET_TITLES[i % len(_MARKET_TITLES)], company, "India", f"We use {', '.join(skills) or 'internal tooling'} every day.",
            via="Job board (demo)", apply_url=f"https://jobs.example/market/{i}",
        ))
    return jobs


def _pages(jobs: list[dict[str, Any]], sizes: tuple[int, ...]) -> list[dict[str, Any]]:
    pages, start = [], 0
    for size in sizes:
        pages.append({"search_metadata": {"status": "Success"}, "jobs_results": jobs[start : start + size]})
        start += size
    return pages


def _news(now: datetime) -> dict[str, Any]:
    def stamp(days: int) -> str:
        return (now - timedelta(days=days)).strftime("%m/%d/%Y, %I:%M %p, +0000 +00")

    def iso(days: int) -> str:
        return (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {"search_metadata": {"status": "Success"}, "news_results": [
        {"position": 1, "title": f"{COMPANY} raises Series B to expand its logistics platform", "link": "https://news.example/lumenpath-series-b",
         "source": {"name": "Example Business Daily"}, "date": stamp(1), "iso_date": iso(1),
         "snippet": f"{COMPANY} said the funds will go to product engineering and a new Pune office."},
        {"position": 2, "title": f"{COMPANY} launches route planner for retailers", "link": "https://techwire.example/lumenpath-route-planner",
         "source": {"name": "Tech Wire (demo)"}, "date": "3 days ago"},  # real responses often carry no snippet
        {"position": 3, "title": f"{COMPANY} opens Pune engineering office", "link": "https://startuppost.example/lumenpath-pune",
         "source": {"name": "Startup Post (demo)"}, "date": "2 weeks ago", "snippet": "The company plans to hire interns and engineers in Pune."},
        {"position": 4, "title": "Logistics software startups to watch", "link": "https://news.example/logistics-watch",
         "source": {"name": "Example Business Daily"}, "date": stamp(9), "iso_date": iso(9), "snippet": "A roundup that does not mention the company in question."},
    ]}


def _google_identity() -> dict[str, Any]:
    return {"search_metadata": {"status": "Success"},
        "knowledge_graph": {
            "title": COMPANY, "type": "Software company",
            "description": f"{COMPANY} builds logistics optimisation software for retailers. (Fictional demo company.)",
            "website": SITE, "headquarters": "Bengaluru, India", "founded": "2016",
            "source": {"name": COMPANY, "link": f"{SITE}/about"},
        },
        "organic_results": [
            {"position": 1, "title": f"{COMPANY} | Logistics optimisation software", "link": f"{SITE}/",
             "snippet": f"{COMPANY} helps retailers plan routes and inventory with optimisation software."},
            {"position": 2, "title": f"Careers at {COMPANY}", "link": f"{SITE}/careers", "snippet": "Join our engineering, data and platform teams."},
            {"position": 3, "title": f"{COMPANY} on LinkedIn", "link": "https://www.linkedin.example/company/lumenpath-labs", "snippet": f"{COMPANY} · Software Development · Bengaluru."},
            {"position": 4, "title": f"{COMPANY} product overview", "link": f"{SITE}/product", "snippet": f"The {COMPANY} platform combines demand forecasting and route planning."},
        ]}


def _google_funding() -> dict[str, Any]:
    return {"search_metadata": {"status": "Success"}, "organic_results": [
        {"position": 1, "title": f"{COMPANY} raises $18M Series B", "link": "https://startupnews.example/lumenpath-series-b",
         "snippet": f"{COMPANY} raised an $18M Series B led by Demo Ventures to grow its logistics platform."},
        {"position": 2, "title": f"{COMPANY} funding and investors", "link": "https://dealwatch.example/lumenpath",
         "snippet": f"{COMPANY} has raised a total of $24M from investors including Demo Ventures."},
    ]}


def demo_routes(now: datetime) -> dict[tuple[str, str], Any]:
    """Recorded responses keyed by ``(engine, lower-cased query)``, matching what the planner will ask for."""
    company_jobs = _company_jobs()
    return {
        ("google", f"{COMPANY} company".lower()): _google_identity(),
        ("google", f"{COMPANY} funding".lower()): _google_funding(),
        ("google_jobs", f"{COMPANY} jobs".lower()): _pages(company_jobs, (10, len(company_jobs) - 10)),
        ("google_jobs", f"{ROLE} {COMPANY}".lower()): _pages([company_jobs[0], company_jobs[12], company_jobs[13]], (3,)),
        ("google_news", f"{COMPANY} company".lower()): _news(now),
        ("google_jobs", ROLE.lower()): _pages(_market_jobs(), (21, 20, 20)),
    }


class ReplayClient(SerpApiClient):
    """A SerpApi client that replays recorded responses instead of calling the network.

    Everything else (parameter building, record-keeping, parsing downstream) is the production code.
    Pagination tokens (``P1``, ``P2`` ...) are injected for multi-page responses.
    """

    def __init__(self, routes: dict[tuple[str, str], Any], settings: Settings | None = None) -> None:
        base = settings or Settings(_env_file=None)
        demo_settings = base.model_copy(update={"serpapi_key": SecretStr("demo-replay-key"), "cache_ttl_hours": 0.0})
        super().__init__(demo_settings, cache=None, sleep=lambda _s: None)
        self._routes = {(engine, q.lower()): payload for (engine, q), payload in routes.items()}
        self.requested: list[tuple[str, str]] = []

    def _request(self, params: dict[str, Any], api_key: str) -> dict[str, Any]:
        key = (params["engine"], params["q"].lower())
        self.requested.append(key)
        payload = self._routes.get(key, {})
        if not isinstance(payload, list):
            return json.loads(json.dumps(payload))
        token = params.get("next_page_token")
        index = int(token[1:]) if token else 0
        page = json.loads(json.dumps(payload[index])) if index < len(payload) else {}
        if index + 1 < len(payload):
            page["serpapi_pagination"] = {"next_page_token": f"P{index + 1}"}
        return page


def demo_client(now: datetime, settings: Settings | None = None) -> ReplayClient:
    return ReplayClient(demo_routes(now), settings)
