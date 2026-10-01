"""Deterministic resume text -> :class:`ResumeProfile`.

No LLM is involved, so resume content never leaves the machine. Every skill records where it was
found (``SkillEvidence``) and at what level: ``listed`` in a skills section, ``used`` in
projects/experience/certifications, or merely ``mentioned`` elsewhere.
"""
from __future__ import annotations

import re

from models.resume import ResumeEntry, ResumeProfile, ResumeSkill, SkillEvidence, SkillLevel
from services.skills import extract_skills, normalize_skill, skill_category

MAX_EVIDENCE_PER_SKILL = 4
_MAX_ENTRIES = 10
_MAX_DETAILS = 6
_MAX_LINES = 12
_SNIPPET_CHARS = 140
MIN_SKILLS_FOR_CONFIDENCE = 5
MIN_CHARS_FOR_CONFIDENCE = 250

_SECTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (kind, re.compile(pattern))
    for kind, pattern in (
        ("summary", r"(?:professional |career )?(?:summary|objective|profile)|about me"),
        ("education", r"education(?:al (?:background|qualifications?))?|academic (?:background|qualifications?)|qualifications?"),
        ("skills", r"(?:technical |key |core |it )?skills(?: (?:&|and) (?:tools|technologies))?|core competenc(?:y|ies)|"
                   r"technologies|tech stack|tools(?: (?:&|and) technologies)?|technical proficienc(?:y|ies)|expertise"),
        ("experience", r"(?:work |professional |industry |relevant |internship )?experience|employment(?: history)?|internships?|work history"),
        ("projects", r"(?:academic |personal |key |selected |notable |technical )?projects?"),
        ("certifications", r"certifications?|certificates?|licen[cs]es?(?: (?:&|and) certifications?)?|courses|training"),
        ("achievements", r"achievements?|awards?(?: (?:&|and) (?:honou?rs|achievements))?|honou?rs|accomplishments|"
                         r"positions? of responsibility|extra-?curricular(?:s| activities)?|leadership"),
        ("other", r"interests|hobbies|languages|references|publications|declaration|personal (?:details|information)"),
    )
)
_HEADING_MAX_CHARS = 45
_BULLET = re.compile(r"^(?:[-•*▪●◦·➢➤►]|\d+[.)])\s*")
_URL_OR_EMAIL = re.compile(r"https?://\S+|www\.\S+|\S+@\S+\.\S+|\b(?:github|linkedin|gitlab)\.com/\S*", re.I)
_NAME = re.compile(r"^[A-Za-z][A-Za-z.'\-]*(?: [A-Za-z][A-Za-z.'\-]*){1,3}$")
_NOT_A_NAME = re.compile(
    r"\b(engineer|developer|analyst|intern|student|resume|curriculum|vitae|manager|designer|scientist|"
    r"consultant|profile|summary|fresher|graduate|architect|specialist|programmer|contact)\b",
    re.I,
)
_SKILL_SPLIT = re.compile(r"[,;|•·/()\[\]]|\s{2,}|\s+[-–]\s+")
_SECTION_LEVEL: dict[str, SkillLevel] = {
    "skills": "listed", "projects": "used", "experience": "used", "certifications": "mentioned",
    "education": "mentioned", "summary": "mentioned", "achievements": "mentioned", "other": "mentioned", "header": "mentioned",
}
_SECTION_LABEL = {
    "skills": "Skills", "projects": "Projects", "experience": "Experience", "certifications": "Certifications",
    "education": "Education", "summary": "Summary", "achievements": "Achievements", "other": "Other", "header": "Resume",
}
_RANK = {"listed": 3, "self_reported": 3, "used": 2, "mentioned": 1}


def _heading_kind(line: str) -> str | None:
    if len(line) > _HEADING_MAX_CHARS or _BULLET.match(line):
        return None
    normalized = " ".join(re.sub(r"[^a-z&\- ]", " ", line.lower()).split())
    if not normalized:
        return None
    for kind, pattern in _SECTION_PATTERNS:
        if pattern.fullmatch(normalized):
            return kind
    return None


def _split_sections(lines: list[str]) -> tuple[list[str], dict[str, list[str]], list[str]]:
    """``(header lines, {kind: lines}, section kinds in order found)``; repeated headings are merged."""
    header: list[str] = []
    sections: dict[str, list[str]] = {}
    order: list[str] = []
    current: str | None = None
    for line in lines:
        kind = _heading_kind(line.rstrip(":").strip())
        if kind:
            current = kind
            if kind not in sections:
                sections[kind] = []
                order.append(kind)
        elif current is None:
            header.append(line)
        else:
            sections[current].append(line)
    return header, sections, order


def _find_name(header: list[str], fallback: list[str]) -> str | None:
    for line in (header or fallback)[:5]:
        candidate = _URL_OR_EMAIL.sub("", line).strip(" |•·,")
        if 3 <= len(candidate) <= 40 and _NAME.match(candidate) and not _NOT_A_NAME.search(candidate):
            return candidate.title() if candidate.isupper() else candidate
    return None


def _strip(line: str) -> str:
    return _URL_OR_EMAIL.sub(" ", line)


def _snippet(line: str) -> str:
    line = _BULLET.sub("", " ".join(line.split()))
    return line if len(line) <= _SNIPPET_CHARS else line[: _SNIPPET_CHARS - 1].rstrip() + "…"


def _skills_from_skills_section(lines: list[str]) -> list[tuple[str, str]]:
    """``(canonical skill, source line)`` pairs from a skills section ("Languages: Python, Java (Spring)")."""
    found: list[tuple[str, str]] = []
    for line in lines:
        content = _strip(line)
        if ":" in content and len(content.split(":", 1)[0]) <= 30:
            content = content.split(":", 1)[1]  # drop a label like "Languages:"
        names: list[str] = []
        for token in _SKILL_SPLIT.split(content):
            token = token.strip(" .:")
            if not token:
                continue
            skill = normalize_skill(token)
            names += [skill] if skill else extract_skills(token)
        found += [(name, line) for name in dict.fromkeys(names)]
    return found


def _entries(lines: list[str]) -> list[ResumeEntry]:
    entries: list[ResumeEntry] = []
    current: ResumeEntry | None = None
    for line in lines:
        is_bullet = bool(_BULLET.match(line))
        text = _snippet(line)
        starts_new = not is_bullet and (current is None or bool(current.details))
        if starts_new:
            current = ResumeEntry(title=text[:160])
            entries.append(current)
        elif current is not None and len(current.details) < _MAX_DETAILS:
            current.details.append(text[:200])
    return entries[:_MAX_ENTRIES]


def _clean_lines(lines: list[str]) -> list[str]:
    return [_snippet(line) for line in lines if line.strip()][:_MAX_LINES]


def _collect_skills(header: list[str], sections: dict[str, list[str]], has_sections: bool) -> list[ResumeSkill]:
    evidence: dict[str, list[tuple[SkillLevel, SkillEvidence]]] = {}

    def add(name: str, level: SkillLevel, section: str, line: str) -> None:
        evidence.setdefault(name, []).append((level, SkillEvidence(section=_SECTION_LABEL[section], snippet=_snippet(line))))

    for name, line in _skills_from_skills_section(sections.get("skills", [])):
        add(name, "listed", "skills", line)
    scan = {**sections, **({} if has_sections else {"header": header})}
    for section, lines in scan.items():
        if section == "skills":
            continue
        for line in lines:
            for name in extract_skills(_strip(line)):
                add(name, _SECTION_LEVEL[section], section, line)

    skills: list[ResumeSkill] = []
    for name, items in evidence.items():
        level = max((lvl for lvl, _ in items), key=lambda l: _RANK[l])
        seen: set[tuple[str, str]] = set()
        unique: list[SkillEvidence] = []
        for _lvl, ev in sorted(items, key=lambda it: -_RANK[it[0]]):
            key = (ev.section, ev.snippet)
            if key not in seen:
                seen.add(key)
                unique.append(ev)
        skills.append(ResumeSkill(name=name, category=skill_category(name), level=level, evidence=unique[:MAX_EVIDENCE_PER_SKILL]))
    return sorted(skills, key=lambda s: (-s.rank, s.name))


def parse_resume_text(text: str) -> ResumeProfile:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    header, sections, order = _split_sections(lines)
    has_sections = bool(order)
    profile = ResumeProfile(
        name=_find_name(header, lines),
        education=_clean_lines(sections.get("education", [])),
        projects=_entries(sections.get("projects", [])),
        experience=_entries(sections.get("experience", [])),
        certifications=_clean_lines(sections.get("certifications", [])),
        achievements=_clean_lines(sections.get("achievements", [])),
        sections_found=order,
        char_count=len(text),
        skills=_collect_skills(header, sections, has_sections),
    )
    if "skills" not in sections:
        profile.notes.append("No 'Skills' section was found; skills were detected from the rest of the text.")
    few_skills = len(profile.skills) < MIN_SKILLS_FOR_CONFIDENCE
    if few_skills or len(text) < MIN_CHARS_FOR_CONFIDENCE:
        profile.quality = "limited"
        reason = (
            f"Only {len(profile.skills)} skill(s) were detected"
            if few_skills else f"The resume text is very short ({len(text)} characters)"
        )
        profile.notes.append(f"{reason}, so 'not found in resume' results may not be meaningful.")
    return profile


def add_self_reported_skills(profile: ResumeProfile, skills: list[str]) -> ResumeProfile:
    """Merge skills the user typed into the preferences form (treated like a skills-section entry)."""
    existing = {s.name: s for s in profile.skills}
    for raw in skills:
        name = normalize_skill(raw)
        if not name:
            profile.notes.append(f"'{raw}' was not recognised as a known skill and was ignored.")
            continue
        evidence = SkillEvidence(section="Preferences", snippet="Entered by you")
        if name in existing:
            if not any(e.section == "Preferences" for e in existing[name].evidence):  # idempotent on refresh
                existing[name].evidence.append(evidence)
            if existing[name].rank < _RANK["self_reported"]:
                existing[name].level = "self_reported"
        else:
            skill = ResumeSkill(name=name, category=skill_category(name), level="self_reported", evidence=[evidence])
            profile.skills.append(skill)
            existing[name] = skill
    profile.skills.sort(key=lambda s: (-s.rank, s.name))
    return profile
