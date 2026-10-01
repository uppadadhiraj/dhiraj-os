"""Resume vs. opportunity skill matching.

Statuses (see :class:`models.resume.SkillMatch`):

``matched``    listed or used on the resume, or directly implied by a skill that is ("Postgres" => SQL)
``partial``    only mentioned in passing (e.g. coursework), or a related-but-different skill is present
``not_found``  not found on the resume. This is *not* a claim that the person lacks the skill
``unknown``    the resume was too sparse for absence to mean anything

Nothing is matched on string similarity; only the taxonomy's exact skills and the small,
explicit relations below.
"""
from __future__ import annotations

from models.opportunity import OpportunityProfile
from models.resume import FitSummary, ResumeProfile, ResumeSkill, SkillMatch
from services.scraping.text_parsers import format_experience

# resume skill -> skills that using it directly demonstrates
IMPLIES: dict[str, set[str]] = {
    "PostgreSQL": {"SQL"}, "MySQL": {"SQL"}, "SQLite": {"SQL"}, "SQL Server": {"SQL"}, "Oracle Database": {"SQL"},
    "FastAPI": {"Python"}, "Flask": {"Python"}, "Django": {"Python"}, "Pandas": {"Python"}, "NumPy": {"Python"},
    "PyTorch": {"Python"}, "scikit-learn": {"Python"},
    "TypeScript": {"JavaScript"}, "React": {"JavaScript"}, "Angular": {"JavaScript"}, "Vue.js": {"JavaScript"},
    "Next.js": {"JavaScript", "React"}, "Node.js": {"JavaScript"}, "Express.js": {"JavaScript", "Node.js"},
    "React Native": {"JavaScript", "React"},
    "Spring Boot": {"Java"}, "ASP.NET": {".NET"}, "Ruby on Rails": {"Ruby"}, "Laravel": {"PHP"}, "Flutter": {"Dart"},
    "GitHub": {"Git"}, "GitLab": {"Git"}, "GitHub Actions": {"CI/CD", "Git"},
    "Lambda": {"AWS"}, "S3": {"AWS"}, "DynamoDB": {"AWS"}, "BigQuery": {"GCP"},
    "Deep Learning": {"Machine Learning"}, "MLOps": {"Machine Learning"},
}

# groups of related-but-different skills: having one is a *partial* match for another
_RELATED_GROUPS: tuple[frozenset[str], ...] = tuple(frozenset(g) for g in (
    {"AWS", "Azure", "GCP"},
    {"PostgreSQL", "MySQL", "SQLite", "SQL Server", "Oracle Database", "SQL"},
    {"MongoDB", "Redis", "Cassandra", "DynamoDB", "Elasticsearch", "NoSQL"},
    {"React", "Angular", "Vue.js", "Next.js"},
    {"Django", "Flask", "FastAPI"},
    {"TensorFlow", "PyTorch"},
    {"Docker", "Kubernetes"},
    {"Jenkins", "GitHub Actions", "GitLab", "CI/CD"},
    {"Terraform", "Ansible"},
    {"Tableau", "Power BI"},
    {"Java", "Kotlin", "Scala"},
    {"Android", "iOS", "Flutter", "React Native"},
    {"Unit Testing", "TDD", "Selenium"},
    {"Node.js", "Express.js"},
    {"Agile", "Scrum"},
    {"NLP", "Computer Vision", "Generative AI", "Deep Learning"},
))
# skills that are partial evidence for a broader field
_PARTIAL_FOR_FIELD: dict[str, set[str]] = {
    "Machine Learning": {"scikit-learn", "TensorFlow", "PyTorch", "NLP", "Computer Vision", "Generative AI", "Deep Learning"},
    "Data Analysis": {"Pandas", "Tableau", "Power BI", "Excel", "Statistics"},
    "Statistics": {"Data Analysis"},
    "Microservices": {"Docker", "Kubernetes"},
}

_LEVEL_BASIS = {
    "listed": "Listed in the Skills section",
    "self_reported": "Entered by you in the preferences",
    "used": "Used in {sections} on your resume",
}


def _basis(skill: ResumeSkill) -> str:
    if skill.level == "used":
        sections = ", ".join(dict.fromkeys(e.section for e in skill.evidence)) or "your projects or experience"
        return _LEVEL_BASIS["used"].format(sections=sections)
    return _LEVEL_BASIS[skill.level]


def _match_one(skill: str, requirement: str, resume: ResumeProfile) -> SkillMatch:
    own = resume.skill(skill)
    if own:
        if own.level == "mentioned":
            sections = ", ".join(dict.fromkeys(e.section for e in own.evidence))
            return SkillMatch(
                skill=skill, requirement=requirement, status="partial",  # type: ignore[arg-type]
                basis=f"Mentioned only in {sections}; not listed as a skill or used in a project or job",
                resume_evidence=own.evidence,
            )
        return SkillMatch(skill=skill, requirement=requirement, status="matched", basis=_basis(own), resume_evidence=own.evidence)  # type: ignore[arg-type]

    for name in sorted(resume.skill_names):
        candidate = resume.skill(name)
        if candidate and candidate.level != "mentioned" and skill in IMPLIES.get(name, ()):
            return SkillMatch(
                skill=skill, requirement=requirement, status="matched",  # type: ignore[arg-type]
                basis=f"{name} on your resume involves {skill}", related_skill=name, resume_evidence=candidate.evidence,
            )
    for name in sorted(resume.skill_names):
        candidate = resume.skill(name)
        related = any(skill in group and name in group for group in _RELATED_GROUPS) or name in _PARTIAL_FOR_FIELD.get(skill, ())
        if candidate and related:
            return SkillMatch(
                skill=skill, requirement=requirement, status="partial",  # type: ignore[arg-type]
                basis=f"Related skill on your resume: {name} (a different tool from {skill})",
                related_skill=name, resume_evidence=candidate.evidence,
            )
    if resume.quality == "limited":
        return SkillMatch(
            skill=skill, requirement=requirement, status="unknown",  # type: ignore[arg-type]
            basis=f"Resume text was too limited to tell (only {len(resume.skills)} skill(s) detected)",
        )
    where = "the skills you entered" if resume.source == "entered" else "resume"
    return SkillMatch(skill=skill, requirement=requirement, status="not_found", basis=f"Not found in {where}")  # type: ignore[arg-type]


def match_single(skill: str, resume: ResumeProfile, requirement: str = "preferred") -> SkillMatch:
    """Compare one skill (e.g. one seen in the market) with the resume."""
    return _match_one(skill, requirement, resume)


def _count(matches: list[SkillMatch], status: str, *, required_only: bool = False) -> int:
    return sum(m.status == status and (m.requirement == "required" or not required_only) for m in matches)


def match_skills(opp: OpportunityProfile, resume: ResumeProfile) -> FitSummary:
    matches = [_match_one(s, "required", resume) for s in opp.required_skills]
    matches += [_match_one(s, "preferred", resume) for s in opp.preferred_skills if s not in opp.required_skills]
    summary = FitSummary(
        matches=matches,
        resume_quality=resume.quality,
        total_requirements=len(matches),
        matched=_count(matches, "matched"),
        partial=_count(matches, "partial"),
        not_found=_count(matches, "not_found"),
        unknown=_count(matches, "unknown"),
        required_total=len(opp.required_skills),
        required_matched=_count(matches, "matched", required_only=True),
    )
    if not matches:
        summary.notes.append("The listing names no recognisable skills, so there is nothing to compare.")
    else:
        summary.notes.append(
            "Coverage counts only skills found on the resume as matched; partial matches are shown separately. "
            "'Not found' means not found on the resume, not that you lack the skill."
        )
    if resume.quality == "limited":
        summary.notes.append("The resume yielded few skills, so some results are shown as unknown rather than not found.")
    summary.context = _context(opp, resume)
    return summary


def _context(opp: OpportunityProfile, resume: ResumeProfile) -> list[str]:
    """Side-by-side facts (no judgement) for dimensions that are not skills."""
    if resume.source != "pdf":
        return []  # only typed-in skills: there is no resume text to set beside the listing
    lines = []
    if opp.experience_required:
        stated = format_experience(opp.experience_min_years, opp.experience_max_years)
        lines.append(
            f"The listing states its experience requirement as '{opp.experience_required}' ({stated}). "
            f"Your resume lists {len(resume.experience)} experience entr{'y' if len(resume.experience) == 1 else 'ies'} "
            f"and {len(resume.projects)} project{'' if len(resume.projects) == 1 else 's'}."
        )
    if opp.education_required and resume.education:
        lines.append(f"The listing says: '{opp.education_required}'. Your resume lists: '{resume.education[0]}'.")
    return lines
