"""
SQLite wrapper per Tangible Lab. Tiene auth + casi di test + review + commenti
nel file `tangible_lab.db` accanto al server.

Lo schema è creato (e migrato in modo additivo) al boot.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Iterator


_DATA_DIR = os.environ.get("TANGIBLE_LAB_DATA_DIR")
DB_PATH = os.environ.get(
    "TANGIBLE_LAB_DB",
    os.path.join(_DATA_DIR, "tangible_lab.db") if _DATA_DIR
    else os.path.join(os.path.dirname(os.path.abspath(__file__)), "tangible_lab.db"),
)
# Assicura che la cartella esista (volume persistente al primo deploy)
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)

_LOCK = threading.RLock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    with _LOCK:
        conn = _connect()
        try:
            yield conn
        finally:
            conn.close()


SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'tester',  -- 'admin' | 'tester'
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
    )""",

    """CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",

    """CREATE TABLE IF NOT EXISTS test_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,          -- 'client' | 'lead'
        record_json TEXT NOT NULL,   -- JSON
        shared INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    )""",

    """CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_key TEXT NOT NULL,    -- 'predef:client:C001' | 'case:<id>'
        judgement TEXT NOT NULL,     -- 'ok' | 'ko' | 'unsure'
        reason TEXT,                 -- motivazione (label) per ko/unsure; NULL per ok
        reason_text TEXT,            -- testo libero quando reason = 'Altro'
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, target_key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",

    """CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_key TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",

    """CREATE TABLE IF NOT EXISTS checkup_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        answers_json TEXT NOT NULL,   -- JSON {question_id: [answer_ids] | answer_id}
        result_json TEXT NOT NULL,    -- JSON {need_id: 'alto'|'medio'|'basso'} snapshot all'ultimo calcolo
        shared INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    )""",

    "CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_key)",
    "CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_key)",
    "CREATE INDEX IF NOT EXISTS idx_cases_owner ON test_cases(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_cases_shared ON test_cases(shared)",
    "CREATE INDEX IF NOT EXISTS idx_checkup_cases_owner ON checkup_cases(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_checkup_cases_shared ON checkup_cases(shared)",
]


def _ensure_columns(conn, table: str, columns: dict) -> None:
    """Aggiunge colonne mancanti a una tabella esistente (migrazione additiva idempotente)."""
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    for col, decl in columns.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def init_db() -> None:
    with get_conn() as conn:
        for stmt in SCHEMA:
            conn.execute(stmt)
        # Migrazioni additive su DB esistenti
        _ensure_columns(conn, "reviews", {"reason": "TEXT", "reason_text": "TEXT"})
        # Bootstrap admin se non esiste nessun utente
        cur = conn.execute("SELECT COUNT(*) AS c FROM users")
        if cur.fetchone()["c"] == 0:
            from .auth import hash_password
            conn.execute(
                "INSERT INTO users(username, password_hash, role, must_change_password) VALUES (?, ?, 'admin', 1)",
                ("admin", hash_password("admin")),
            )
            print("[tangible_lab] Bootstrap: utente admin/admin creato (cambia la password al primo login)")
