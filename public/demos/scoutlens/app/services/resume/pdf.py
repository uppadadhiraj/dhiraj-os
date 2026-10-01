"""PDF -> text with validation. Runs locally; resume bytes are never sent anywhere."""
from __future__ import annotations

import io
import logging
import re
import unicodedata

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from utils.errors import ResumeParseError

logger = logging.getLogger(__name__)

MAX_PAGES = 10
MIN_TEXT_CHARS = 100
MAX_TEXT_CHARS = 120_000
_PRIVATE_USE = re.compile(r"[-]")  # PDF bullet glyphs often decode to private-use characters


def validate_upload(data: bytes, max_mb: float) -> None:
    """Cheap checks before parsing: non-empty, within the size limit, and really a PDF."""
    if not data:
        raise ResumeParseError("The uploaded file is empty.")
    if len(data) > max_mb * 1024 * 1024:
        raise ResumeParseError(f"The resume is larger than the {max_mb:g} MB limit.")
    if b"%PDF-" not in data[:1024]:
        raise ResumeParseError("That file is not a PDF. Please upload your resume as a PDF.")


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)  # ligatures (ﬁ -> fi), width variants
    text = _PRIVATE_USE.sub("•", text)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.replace("\r", "\n").split("\n")]
    return "\n".join(line for line in lines if line)


def extract_text(data: bytes, *, max_mb: float = 5.0) -> str:
    """Extract clean text from a PDF, or raise :class:`ResumeParseError` with a specific, safe message."""
    validate_upload(data, max_mb)
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ResumeParseError("The PDF is password-protected. Remove the password and upload it again.")
        if len(reader.pages) > MAX_PAGES:
            raise ResumeParseError(f"The PDF has more than {MAX_PAGES} pages, which is too long for a resume.")
        parts: list[str] = []
        total = 0
        for page in reader.pages:
            text = page.extract_text() or ""
            parts.append(text)
            total += len(text)
            if total > MAX_TEXT_CHARS:
                break
    except ResumeParseError:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, AttributeError, OSError, RecursionError) as exc:
        logger.info("PDF parse failed: %s", type(exc).__name__)
        raise ResumeParseError(detail=type(exc).__name__) from None
    text = _clean("\n".join(parts))[:MAX_TEXT_CHARS]
    if len(text) < MIN_TEXT_CHARS:
        raise ResumeParseError(
            "No readable text was found in the PDF. Scanned/image-only resumes are not supported; "
            "export a text-based PDF from your editor instead."
        )
    return text
