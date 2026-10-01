"""Investigation history: save, list, reopen and delete reports (SQLite).

The full report is stored as validated JSON in ``reports``; opportunities, executed searches and
evidence are also kept in their own tables so history stays inspectable with plain SQL.
A stored report that no longer validates (e.g. written by an older version) is treated as
unreadable instead of raising into the UI.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ValidationError

from models.report import InvestigationReport
from services.cache.db import connect
from utils.errors import ScoutLensError

logger = logging.getLogger(__name__)


class InvestigationSummary(BaseModel):
    """A row of the history list."""

    id: str
    created_at: datetime
    input_url: str | None = None
    company: str | None = None
    role: str | None = None
    status: str
    is_demo: bool = False


class HistoryError(ScoutLensError):
    default_message = "The investigation history could not be accessed. Check that the data folder is writable."


class InvestigationRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def save(self, report: InvestigationReport) -> None:
        """Insert or replace ``report`` (idempotent per id). Raises :class:`HistoryError` on database failure."""
        opp = report.opportunity
        try:
            with connect(self._db_path) as conn:
                conn.execute("DELETE FROM investigations WHERE id = ?", (report.id,))  # cascades to child tables
                conn.execute(
                    "INSERT INTO investigations (id, created_at, input_url, company, role, status, is_demo, refreshed)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (report.id, report.created_at.isoformat(), opp.source_url, opp.company_name, opp.role_title,
                     report.status, int(report.is_demo), int(report.method.refreshed)),
                )
                conn.execute("INSERT INTO opportunities (investigation_id, profile_json) VALUES (?, ?)", (report.id, opp.model_dump_json()))
                conn.executemany(
                    "INSERT INTO search_results (investigation_id, search_id, engine, query, purpose, from_cache, fetched_at, result_count, error)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(report.id, s.id, s.engine, s.query, s.purpose, int(s.from_cache), s.fetched_at.isoformat(), s.result_count, s.error)
                     for s in report.method.searches],
                )
                conn.executemany(
                    "INSERT INTO evidence (investigation_id, evidence_id, item_json) VALUES (?, ?, ?)",
                    [(report.id, e.id, e.model_dump_json()) for e in report.evidence],
                )
                conn.execute("INSERT INTO reports (investigation_id, report_json) VALUES (?, ?)", (report.id, report.model_dump_json()))
        except sqlite3.Error as exc:
            logger.warning("Could not save investigation: %s", type(exc).__name__)
            raise HistoryError(detail=type(exc).__name__) from None

    def get(self, investigation_id: str) -> InvestigationReport | None:
        """The stored report, or ``None`` if it does not exist or can no longer be read."""
        try:
            with connect(self._db_path) as conn:
                row = conn.execute("SELECT report_json FROM reports WHERE investigation_id = ?", (investigation_id,)).fetchone()
        except sqlite3.Error:
            logger.warning("Could not read investigation", exc_info=True)
            return None
        if row is None:
            return None
        try:
            return InvestigationReport.model_validate_json(row["report_json"])
        except (ValidationError, json.JSONDecodeError):
            logger.warning("Stored investigation %s no longer validates", investigation_id)
            return None

    def list(self, limit: int = 50) -> list[InvestigationSummary]:
        try:
            with connect(self._db_path) as conn:
                rows = conn.execute(
                    "SELECT id, created_at, input_url, company, role, status, is_demo FROM investigations"
                    " ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,),
                ).fetchall()
        except sqlite3.Error:
            logger.warning("Could not list investigations", exc_info=True)
            return []
        return [InvestigationSummary(**{**dict(r), "is_demo": bool(r["is_demo"])}) for r in rows]

    def delete(self, investigation_id: str) -> bool:
        try:
            with connect(self._db_path) as conn:
                return conn.execute("DELETE FROM investigations WHERE id = ?", (investigation_id,)).rowcount > 0
        except sqlite3.Error as exc:
            raise HistoryError(detail=type(exc).__name__) from None

    def delete_all(self) -> int:
        try:
            with connect(self._db_path) as conn:
                return conn.execute("DELETE FROM investigations").rowcount
        except sqlite3.Error as exc:
            raise HistoryError(detail=type(exc).__name__) from None
