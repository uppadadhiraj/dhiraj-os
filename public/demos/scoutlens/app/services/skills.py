"""Skill taxonomy: alias normalization and boundary-safe extraction from free text.

Alias syntax (per alias, so case rules can never drift from the spelling they apply to):

* ``"docker"``     case-insensitive whole-token match
* ``"cs:Rust"``    case-sensitive whole-token match (words that are also plain English)
* ``"re:..."``     raw case-sensitive regex, for skills that need surrounding context

``extract_skills`` only reports a skill when an alias appears as a whole token, so "Java" never
matches "JavaScript", "SQL" never matches "NoSQL", and ".js" never turns "Node.js" into JavaScript.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import NamedTuple

_B = r"(?<![A-Za-z0-9+#])"  # token boundary before
_A = r"(?![A-Za-z0-9+#])"  # token boundary after

# (canonical name, category, aliases)
_SKILLS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    # --- languages
    ("Python", "language", ("python", "python3", "python 3")),
    ("Java", "language", ("java", "core java")),
    ("JavaScript", "language", ("javascript", "ecmascript", "es6")),
    ("TypeScript", "language", ("typescript",)),
    ("C++", "language", ("c++", "cpp")),
    ("C#", "language", ("c#", "csharp", "c sharp")),
    ("C", "language", (rf"re:{_B}C(?=\s+(?:programming|language)\b)", rf"re:(?<=[,/(]\s)C(?=\s*[,/)])")),
    ("Go", "language", ("golang", "go lang", "go language", "go programming", rf"re:(?<=[,/(]\s)Go(?=\s*[,/)])", rf"re:{_B}Go(?=\s+(?:developer|engineer)\b)")),
    ("Rust", "language", ("cs:Rust",)),
    ("Ruby", "language", ("ruby",)),
    ("PHP", "language", ("php",)),
    ("Kotlin", "language", ("kotlin",)),
    ("Swift", "language", (
        "cs:SwiftUI", "swift programming", "swift language", "swift developer",
        rf"re:(?<=[,/(]\s)Swift{_A}", rf"re:(?<=[,/(])Swift{_A}", rf"re:{_B}Swift(?=\s*[,/)])",
        rf"re:(?<=\bin )Swift{_A}", rf"re:(?<=\bwith )Swift{_A}", rf"re:(?<=\busing )Swift{_A}", rf"re:{_B}Swift(?=\s+\d)",
    )),
    ("Scala", "language", ("scala",)),
    ("R", "language", (rf"re:{_B}R(?=\s+(?:programming|language|studio)\b)", "rstudio", rf"re:(?<=[,/(]\s)R(?=\s*[,/)])")),
    ("MATLAB", "language", ("matlab",)),
    ("Dart", "language", ("dart",)),
    ("Bash", "language", ("bash", "shell scripting", "shell script")),
    ("SQL", "language", ("sql", "t-sql", "pl/sql", "plsql")),
    ("HTML", "language", ("html", "html5")),
    ("CSS", "language", ("css", "css3")),
    # --- web frameworks
    ("React", "framework", ("react.js", "reactjs", "react js", rf"re:{_B}React{_A}(?!\s+(?:to|quickly|fast|swiftly|rapidly|positively|well)\b)")),
    ("Angular", "framework", ("cs:Angular", "angularjs", "angular.js")),
    ("Vue.js", "framework", ("cs:Vue", "vue.js", "vuejs")),
    ("Next.js", "framework", ("next.js", "nextjs")),
    ("Node.js", "framework", ("node.js", "nodejs", "node js")),
    ("Express.js", "framework", ("express.js", "expressjs")),
    ("Django", "framework", ("django",)),
    ("Flask", "framework", ("flask",)),
    ("FastAPI", "framework", ("fastapi", "fast api")),
    ("Spring Boot", "framework", ("spring boot", "springboot", "spring framework", "spring mvc")),
    ("ASP.NET", "framework", ("asp.net", "asp net")),
    (".NET", "framework", (".net", "dotnet", ".net core")),
    ("Ruby on Rails", "framework", ("ruby on rails", "cs:Rails")),
    ("Laravel", "framework", ("laravel",)),
    ("Tailwind CSS", "framework", ("tailwind", "tailwindcss", "tailwind css")),
    ("Flutter", "framework", ("flutter",)),
    ("React Native", "framework", ("react native",)),
    # --- databases
    ("PostgreSQL", "database", ("postgresql", "postgres", "postgresql database", "psql")),
    ("MySQL", "database", ("mysql",)),
    ("SQLite", "database", ("sqlite", "sqlite3")),
    ("MongoDB", "database", ("mongodb", "mongo db", "mongo")),
    ("Redis", "database", ("redis",)),
    ("SQL Server", "database", ("sql server", "mssql", "ms sql", "microsoft sql server")),
    ("Oracle Database", "database", ("oracle database", "oracle db", "oracle sql")),
    ("Elasticsearch", "database", ("elasticsearch", "elastic search", "opensearch")),
    ("Cassandra", "database", ("cassandra",)),
    ("DynamoDB", "database", ("dynamodb",)),
    ("Snowflake", "database", ("cs:Snowflake",)),
    ("BigQuery", "database", ("bigquery", "big query")),
    ("NoSQL", "database", ("nosql",)),
    # --- cloud
    ("AWS", "cloud", ("aws", "amazon web services", "amazon aws")),
    ("Azure", "cloud", ("azure", "microsoft azure")),
    ("GCP", "cloud", ("gcp", "google cloud", "google cloud platform")),
    ("Lambda", "cloud", ("aws lambda", "lambda functions")),
    ("S3", "cloud", ("amazon s3", "aws s3")),
    # --- devops
    ("Docker", "devops", ("docker", "dockerfile", "docker compose", "docker-compose")),
    ("Kubernetes", "devops", ("kubernetes", "k8s")),
    ("Terraform", "devops", ("terraform",)),
    ("Ansible", "devops", ("ansible",)),
    ("Jenkins", "devops", ("jenkins",)),
    ("CI/CD", "devops", ("ci/cd", "ci-cd", "cicd", "continuous integration", "continuous delivery", "continuous deployment")),
    ("GitHub Actions", "devops", ("github actions",)),
    ("Linux", "devops", ("linux",)),
    ("Nginx", "devops", ("nginx",)),
    ("Prometheus", "devops", ("prometheus",)),
    ("Grafana", "devops", ("grafana",)),
    # --- data / ML
    ("Machine Learning", "data_ml", ("machine learning", "ml models", "ml algorithms")),
    ("Deep Learning", "data_ml", ("deep learning", "neural networks")),
    ("NLP", "data_ml", ("nlp", "natural language processing")),
    ("Computer Vision", "data_ml", ("computer vision", "opencv")),
    ("Generative AI", "data_ml", ("generative ai", "genai", "gen ai", "large language models", "llms", "llm")),
    ("TensorFlow", "data_ml", ("tensorflow",)),
    ("PyTorch", "data_ml", ("pytorch",)),
    ("scikit-learn", "data_ml", ("scikit-learn", "scikit learn", "sklearn")),
    ("Pandas", "data_ml", ("pandas",)),
    ("NumPy", "data_ml", ("numpy",)),
    ("Apache Spark", "data_ml", (
        "apache spark", "pyspark", "spark sql", "spark streaming",
        rf"re:(?<=[,/(]\s)Spark{_A}", rf"re:{_B}Spark(?=\s*[,/)])",
    )),
    ("Apache Kafka", "data_ml", ("kafka", "apache kafka")),
    ("Airflow", "data_ml", ("airflow", "apache airflow")),
    ("Hadoop", "data_ml", ("hadoop",)),
    ("ETL", "data_ml", ("etl", "elt", "data pipelines", "data pipeline")),
    ("Data Analysis", "data_ml", ("data analysis", "data analytics", "exploratory data analysis")),
    ("Tableau", "data_ml", ("tableau",)),
    ("Power BI", "data_ml", ("power bi", "powerbi")),
    ("Excel", "data_ml", ("ms excel", "microsoft excel", "advanced excel", rf"re:{_B}Excel{_A}(?!\s+(?:at|in|under)\b)")),
    ("Statistics", "data_ml", ("statistics", "statistical analysis", "statistical modeling")),
    ("MLOps", "data_ml", ("mlops",)),
    # --- tools / practices
    ("Git", "tool", ("git", "version control")),
    ("GitHub", "tool", ("github",)),
    ("GitLab", "tool", ("gitlab",)),
    ("Jira", "tool", ("jira",)),
    ("Postman", "tool", ("postman",)),
    ("Figma", "tool", ("figma",)),
    ("REST APIs", "practice", ("rest api", "rest apis", "restful", "rest services", "restful apis")),
    ("GraphQL", "practice", ("graphql",)),
    ("gRPC", "practice", ("grpc",)),
    ("Microservices", "practice", ("microservices", "microservice")),
    ("System Design", "practice", ("system design", "distributed systems", "software architecture")),
    ("Data Structures", "practice", ("data structures", "dsa")),
    ("Algorithms", "practice", ("algorithms",)),
    ("OOP", "practice", ("oop", "object-oriented", "object oriented")),
    ("Unit Testing", "practice", ("unit testing", "unit tests", "pytest", "junit")),
    ("TDD", "practice", ("tdd", "test-driven development", "test driven development")),
    ("Agile", "practice", ("agile", "agile methodology")),
    ("Scrum", "practice", ("scrum",)),
    ("Selenium", "tool", ("selenium",)),
    ("Android", "framework", ("android", "android sdk")),
    ("iOS", "framework", ("cs:iOS",)),
    ("Blockchain", "practice", ("blockchain", "solidity", "web3")),
    ("Cybersecurity", "practice", (
        "cybersecurity", "cyber security", "information security", "penetration testing", "appsec", "infosec",
        "security engineering", "security architecture", "security architect", "application security", "cloud security",
        "network security", "devsecops", "threat modeling", "threat modelling", "vulnerability management",
    )),
    ("Salesforce", "tool", ("salesforce",)),
    ("SAP", "tool", ("cs:SAP",)),
)


class _Compiled(NamedTuple):
    name: str
    category: str
    pattern: re.Pattern[str]


def _fragment(alias: str) -> str:
    if alias.startswith("re:"):
        return alias[3:]
    if alias.startswith("cs:"):
        return _B + re.escape(alias[3:]) + _A
    return "(?i:" + _B + re.escape(alias) + _A + ")"


@lru_cache(maxsize=1)
def _compiled() -> tuple[_Compiled, ...]:
    compiled: list[_Compiled] = []
    for name, category, aliases in _SKILLS:
        ordered = sorted(aliases, key=len, reverse=True)  # prefer the longest alias at a position
        compiled.append(_Compiled(name, category, re.compile("|".join(f"(?:{_fragment(a)})" for a in ordered))))
    return tuple(compiled)


@lru_cache(maxsize=1)
def _alias_index() -> dict[str, str]:
    """Lower-cased literal alias -> canonical name, for whole-string normalization."""
    index: dict[str, str] = {}
    for name, _category, aliases in _SKILLS:
        index[name.lower()] = name
        for alias in aliases:
            if not alias.startswith("re:"):
                index.setdefault(alias.removeprefix("cs:").lower(), name)
    return index


def normalize_skill(text: str) -> str | None:
    """Map one skill string ("Postgres", "PostgreSQL database") to its canonical name.

    Returns ``None`` when the string is not a known skill; it never guesses by similarity.
    """
    cleaned = re.sub(r"\s+", " ", text.strip().strip(".,;:()[]")).lower()
    return _alias_index().get(cleaned)


def extract_skills(text: str) -> list[str]:
    """Canonical skill names found in ``text``, ordered by first appearance."""
    if not text:
        return []
    found: list[tuple[int, str]] = []
    for skill in _compiled():
        match = skill.pattern.search(text)
        if match:
            found.append((match.start(), skill.name))
    found.sort()
    return [name for _pos, name in found]


def skill_category(name: str) -> str | None:
    return next((category for skill, category, _aliases in _SKILLS if skill == name), None)


def all_skill_names() -> list[str]:
    return [name for name, _category, _aliases in _SKILLS]
