"""URL sanitisation and SSRF protection for user-supplied opportunity links.

The server fetches whatever URL a user pastes, so hosts that resolve to private, loopback,
link-local or otherwise non-public addresses are refused. (A DNS-rebinding race between this
check and the actual connection is a known residual risk for the MVP; see README limitations.)
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

from utils.errors import InvalidURLError

MAX_URL_LENGTH = 2048
ALLOWED_PORTS = {None, 80, 443}
_BLOCKED_SUFFIXES = (".local", ".internal", ".localhost", ".lan", ".home", ".corp")


def normalize_url(raw: str) -> str:
    """Trim, default to https, and reject anything that is not a plain absolute http(s) URL."""
    url = (raw or "").strip()
    if not url:
        raise InvalidURLError("Please paste an opportunity URL.")
    if len(url) > MAX_URL_LENGTH or any(c in url for c in ("\n", "\r", "\t", " ")):
        raise InvalidURLError()
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise InvalidURLError()
    if parsed.username or parsed.password:
        raise InvalidURLError("URLs containing credentials are not accepted.")
    try:
        port = parsed.port
    except ValueError:
        raise InvalidURLError() from None
    if port not in ALLOWED_PORTS:
        raise InvalidURLError("Only standard web ports (80/443) are supported.")
    return urlunparse(parsed._replace(fragment=""))


def _is_public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return ip.is_global and not ip.is_multicast


def assert_public_host(hostname: str) -> None:
    """Raise :class:`InvalidURLError` unless ``hostname`` resolves only to public IP addresses."""
    host = hostname.strip("[]").lower()
    if host == "localhost" or host.endswith(_BLOCKED_SUFFIXES):
        raise InvalidURLError("That address is not a public website.")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        addresses = [literal]
    else:
        try:
            infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise InvalidURLError("That website's address could not be found.") from None
        addresses = [ipaddress.ip_address(info[4][0].split("%")[0]) for info in infos]
    if not addresses or not all(_is_public(ip) for ip in addresses):
        raise InvalidURLError("That address is not a public website.")


def validate_public_url(raw: str) -> str:
    """Normalise ``raw`` and verify it points at a public host. Returns the cleaned URL."""
    url = normalize_url(raw)
    assert_public_host(urlparse(url).hostname or "")
    return url
