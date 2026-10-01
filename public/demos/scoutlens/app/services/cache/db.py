"""SQLite plumbing shared by the search cache and (later) the investigation repository.

A new short-lived connection is opened per operation: Streamlit reruns scripts on different
threads, and sqlite3 connections must not be shared across threads. The default rollback
journal is used instead of WAL because the project may live in a cloud-synced folder
(OneDrive/Dropbox), where WAL's side files cause lock contention.
"""
from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS search_cache (
        cache_key     TEXT PRIMARY KEY,
        engine        TEXT NOT NULL,
        query         TEXT NOT NULL,
        response_json TEXT NOT NULL,
        fetched_at    REAL NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS investigations (
        id         TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        input_url  TEXT,
        company    TEXT,
        role       TEXT,
        status     TEXT NOT NULL,
        is_demo    INTEGER NOT NULL DEFAULT 0,
        refreshed  INTEGER NOT NULL DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS opportunities (
        investigation_id TEXT PRIMARY KEY REFERENCES investigations(id) ON DELETE CASCADE,
        profile_json     TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS search_results (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
        search_id        TEXT NOT NULL,
        engine           TEXT NOT NULL,
        query            TEXT NOT NULL,
        purpose          TEXT,
        from_cache       INTEGER NOT NULL,
        fetched_at       TEXT NOT NULL,
        result_count     INTEGER NOT NULL,
        error            TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence (
        investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
        evidence_id      TEXT NOT NULL,
        item_json        TEXT NOT NULL,
        PRIMARY KEY (investigation_id, evidence_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reports (
        investigation_id TEXT PRIMARY KEY REFERENCES investigations(id) ON DELETE CASCADE,
        report_json      TEXT NOT NULL
    )
    """,
)


@contextmanager
def connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    """Open a connection, commit on success / roll back on error, always close.

    A data folder that cannot be created (read-only disk, bad permissions) is reported as
    ``sqlite3.OperationalError`` so callers handle one failure type for every kind of storage problem.
    """
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise sqlite3.OperationalError(f"data folder unavailable: {type(exc).__name__}") from None
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        for statement in SCHEMA:
            conn.execute(statement)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
