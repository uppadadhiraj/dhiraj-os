"""Turn HTML into line-oriented text that keeps just enough structure (headings, bullets)
for the section parser: headings become ``## Heading`` and list items become ``- item``."""
from __future__ import annotations

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

_SKIP = {"script", "style", "noscript", "svg", "iframe", "form", "button", "select", "template"}
_CHROME = {"nav", "footer", "header", "aside"}  # page furniture, removed when picking main content
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_BLOCK = {
    "p", "div", "section", "article", "main", "ul", "ol", "table", "tr", "dl", "dt", "dd",
    "blockquote", "pre", "address", "fieldset", "figure", "details", "summary",
}
_PSEUDO_HEADING_MAX_LEN = 60


def _is_pseudo_heading(block: Tag) -> bool:
    """``<p><strong>Requirements</strong></p>`` is a heading in everything but tag name."""
    children = [
        c for c in block.children if not (isinstance(c, NavigableString) and not str(c).strip())
    ]
    if len(children) != 1 or not isinstance(children[0], Tag):
        return False
    only = children[0]
    return only.name in {"strong", "b"} and 0 < len(only.get_text(strip=True)) <= _PSEUDO_HEADING_MAX_LEN


def html_to_text(root: Tag | BeautifulSoup) -> str:
    lines: list[str] = []
    buffer: list[str] = []
    pending_prefix = [""]

    def flush(prefix: str = "") -> None:
        text = " ".join("".join(buffer).split())
        buffer.clear()
        if text:
            lines.append((prefix or pending_prefix[0]) + text)
            pending_prefix[0] = ""

    def walk(node: Tag | BeautifulSoup) -> None:
        for child in node.children:
            if isinstance(child, Comment):
                continue
            if isinstance(child, NavigableString):
                buffer.append(str(child))
                continue
            if not isinstance(child, Tag):
                continue
            name = (child.name or "").lower()
            if name in _SKIP:
                continue
            if name == "br":
                flush()
            elif name in _HEADINGS:
                flush()
                walk(child)
                flush("## ")
            elif name == "li":
                flush()
                pending_prefix[0] = "- "
                walk(child)
                flush()
                pending_prefix[0] = ""
            elif name in _BLOCK:
                flush()
                if _is_pseudo_heading(child):
                    walk(child)
                    flush("## ")
                else:
                    walk(child)
                    flush()
            else:
                walk(child)  # inline element

    walk(root)
    flush()
    return "\n".join(lines)


def extract_main_text(soup: BeautifulSoup) -> str:
    """Readable text of the page's main content, without navigation/footer chrome."""
    for tag in soup.find_all(list(_CHROME)):
        tag.decompose()
    candidates = [*soup.find_all(["main", "article"]), *soup.select('[role="main"]')]
    root: Tag | BeautifulSoup = soup.body or soup
    if candidates:
        root = max(candidates, key=lambda t: len(t.get_text(strip=True)))
    return html_to_text(root)


def fragment_to_text(markup: str) -> str:
    """Convert an HTML fragment (e.g. a JSON-LD ``description``) or plain text into structured text."""
    if "<" not in markup and "&lt;" in markup:
        import html

        markup = html.unescape(markup)
    if "<" not in markup:
        # Some ATS exports double-escape newlines, leaving a literal backslash-n in the text.
        markup = markup.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\t", " ")
        return "\n".join(line.strip() for line in markup.splitlines() if line.strip())
    soup = BeautifulSoup(markup, "lxml")
    return html_to_text(soup.body or soup)
