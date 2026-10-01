"""Polite, SSRF-safe page fetching.

* Every URL (including each redirect hop) must resolve to a public host.
* robots.txt is honoured (4xx = no rules; 5xx/unreachable = treated as disallow, per RFC 9309).
* Size, time and redirect limits apply; only HTML/text responses are accepted.
* A per-host minimum interval keeps ScoutLens from hammering any site.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests

from utils.errors import ExtractionError
from utils.urls import validate_public_url

logger = logging.getLogger(__name__)

USER_AGENT = "ScoutLens/0.1 (+opportunity research tool; honours robots.txt)"
ROBOTS_TOKEN = "ScoutLens"
MAX_BYTES = 2_500_000
MAX_REDIRECTS = 4
_REDIRECT_CODES = {301, 302, 303, 307, 308}
_HTML_TYPES = ("text/html", "application/xhtml+xml", "text/plain")
_PASTE_HINT = " You can paste the job description manually instead."

_last_request: dict[str, float] = {}  # host -> monotonic time of last request


@dataclass
class FetchedPage:
    url: str  # final URL after redirects
    status: int
    content_type: str
    content: bytes
    truncated: bool = False


class PageFetcher:
    def __init__(
        self,
        session: requests.Session | None = None,
        timeout: float = 15.0,
        min_interval: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._session = session or requests.Session()
        self._timeout = timeout
        self._min_interval = min_interval
        self._sleep = sleep
        self._clock = clock
        self._robots: dict[str, RobotFileParser | None] = {}  # None = disallow everything

    # ------------------------------------------------------------------ public

    def fetch(self, raw_url: str) -> FetchedPage:
        url = validate_public_url(raw_url)
        for _hop in range(MAX_REDIRECTS + 1):
            if not self._allowed_by_robots(url):
                raise ExtractionError(
                    "This website's robots.txt does not allow automated access, so ScoutLens did not "
                    "fetch the page." + _PASTE_HINT
                )
            resp = self._get(url, stream=True)
            try:
                if resp.status_code in _REDIRECT_CODES and resp.headers.get("Location"):
                    url = validate_public_url(urljoin(url, resp.headers["Location"]))
                    continue
                return self._read(resp, url)
            finally:
                resp.close()
        raise ExtractionError("The link redirected too many times." + _PASTE_HINT)

    # ----------------------------------------------------------------- helpers

    def _get(self, url: str, *, stream: bool = False) -> requests.Response:
        self._throttle(urlparse(url).hostname or "")
        try:
            return self._session.get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
                timeout=self._timeout,
                allow_redirects=False,
                stream=stream,
            )
        except requests.Timeout:
            raise ExtractionError("The website took too long to respond." + _PASTE_HINT) from None
        except requests.RequestException as exc:
            logger.info("Fetch failed for %s: %s", urlparse(url).hostname, type(exc).__name__)
            raise ExtractionError("The website could not be reached." + _PASTE_HINT) from None

    def _read(self, resp: requests.Response, url: str) -> FetchedPage:
        status = resp.status_code
        if status in (401, 403, 429, 999):
            raise ExtractionError(
                f"The website refused automated access (HTTP {status})." + _PASTE_HINT
            )
        if status == 404 or status == 410:
            raise ExtractionError(
                f"The page was not found (HTTP {status}); the listing may have been removed."
                + _PASTE_HINT
            )
        if status >= 400:
            raise ExtractionError(f"The website returned an error (HTTP {status})." + _PASTE_HINT)
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if content_type and not content_type.startswith(_HTML_TYPES):
            raise ExtractionError("That link does not point to a web page." + _PASTE_HINT)

        chunks: list[bytes] = []
        size = 0
        truncated = False
        for chunk in resp.iter_content(chunk_size=16_384):
            size += len(chunk)
            chunks.append(chunk)
            if size >= MAX_BYTES:
                truncated = True
                break
        return FetchedPage(
            url=url,
            status=status,
            content_type=content_type,
            content=b"".join(chunks)[:MAX_BYTES],
            truncated=truncated,
        )

    def _throttle(self, host: str) -> None:
        wait = self._min_interval - (self._clock() - _last_request.get(host, float("-inf")))
        if wait > 0:
            self._sleep(wait)
        _last_request[host] = self._clock()

    def _allowed_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self._robots:
            self._robots[origin] = self._load_robots(origin)
        rules = self._robots[origin]
        return rules is not None and rules.can_fetch(ROBOTS_TOKEN, url)

    def _load_robots(self, origin: str) -> RobotFileParser | None:
        parser = RobotFileParser()
        try:
            resp = self._get(f"{origin}/robots.txt")
        except ExtractionError:
            return None  # cannot verify -> be conservative
        try:
            if 400 <= resp.status_code < 500:
                parser.parse([])  # no robots.txt: everything allowed
                return parser
            if resp.status_code >= 500:
                return None
            parser.parse(resp.text.splitlines())
            return parser
        finally:
            resp.close()
