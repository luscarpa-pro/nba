"""
CRUD su SQLite per Tangible Lab.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .db import get_conn


# ============================== users ==============================

def list_users() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT id, username, role, active, must_change_password, created_at, last_login_at FROM users ORDER BY id"
        ).fetchall()]


def get_user(user_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role, active, must_change_password, created_at, last_login_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, role, active, must_change_password FROM users WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()
        return dict(row) if row else None


def create_user(username: str, password_hash: str, role: str = "tester", must_change_password: bool = True) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users(username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)",
            (username, password_hash, role, 1 if must_change_password else 0),
        )
        return int(cur.lastrowid)


def update_user(user_id: int, *, role: Optional[str] = None, active: Optional[bool] = None,
                password_hash: Optional[str] = None, must_change_password: Optional[bool] = None) -> None:
    sets, params = [], []
    if role is not None:
        sets.append("role = ?"); params.append(role)
    if active is not None:
        sets.append("active = ?"); params.append(1 if active else 0)
    if password_hash is not None:
        sets.append("password_hash = ?"); params.append(password_hash)
    if must_change_password is not None:
        sets.append("must_change_password = ?"); params.append(1 if must_change_password else 0)
    if not sets:
        return
    params.append(user_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params)


def delete_user(user_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# ============================== test_cases ==============================

def list_cases_visible_to(user_id: int) -> List[Dict[str, Any]]:
    """Casi propri + casi condivisi (anche di altri utenti)."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT tc.id, tc.owner_id, u.username AS owner_username, tc.name, tc.type,
                      tc.record_json, tc.shared, tc.notes, tc.created_at, tc.updated_at
               FROM test_cases tc JOIN users u ON u.id = tc.owner_id
               WHERE tc.owner_id = ? OR tc.shared = 1
               ORDER BY tc.updated_at DESC""",
            (user_id,),
        ).fetchall()
    return [_case_row_to_dict(r) for r in rows]


def list_all_cases() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT tc.id, tc.owner_id, u.username AS owner_username, tc.name, tc.type,
                      tc.record_json, tc.shared, tc.notes, tc.created_at, tc.updated_at
               FROM test_cases tc JOIN users u ON u.id = tc.owner_id
               ORDER BY tc.updated_at DESC"""
        ).fetchall()
    return [_case_row_to_dict(r) for r in rows]


def get_case(case_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            """SELECT tc.id, tc.owner_id, u.username AS owner_username, tc.name, tc.type,
                      tc.record_json, tc.shared, tc.notes, tc.created_at, tc.updated_at
               FROM test_cases tc JOIN users u ON u.id = tc.owner_id
               WHERE tc.id = ?""",
            (case_id,),
        ).fetchone()
        return _case_row_to_dict(row) if row else None


def _case_row_to_dict(row) -> Dict[str, Any]:
    d = dict(row)
    try:
        d["record"] = json.loads(d.pop("record_json"))
    except Exception:
        d["record"] = {}
        d.pop("record_json", None)
    d["shared"] = bool(d.get("shared"))
    return d


def create_case(owner_id: int, name: str, type_: str, record: dict, shared: bool, notes: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO test_cases(owner_id, name, type, record_json, shared, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (owner_id, name, type_, json.dumps(record, ensure_ascii=False), 1 if shared else 0, notes),
        )
        return int(cur.lastrowid)


def update_case(case_id: int, *, name: Optional[str] = None, type_: Optional[str] = None,
                record: Optional[dict] = None, shared: Optional[bool] = None, notes: Optional[str] = None) -> None:
    sets, params = [], []
    if name is not None: sets.append("name = ?"); params.append(name)
    if type_ is not None: sets.append("type = ?"); params.append(type_)
    if record is not None: sets.append("record_json = ?"); params.append(json.dumps(record, ensure_ascii=False))
    if shared is not None: sets.append("shared = ?"); params.append(1 if shared else 0)
    if notes is not None: sets.append("notes = ?"); params.append(notes)
    if not sets:
        return
    sets.append("updated_at = datetime('now')")
    params.append(case_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE test_cases SET {', '.join(sets)} WHERE id = ?", params)


def delete_case(case_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM test_cases WHERE id = ?", (case_id,))


# ============================== reviews ==============================

def get_user_review(user_id: int, target_key: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, judgement, reason, reason_text, created_at, updated_at FROM reviews WHERE user_id = ? AND target_key = ?",
            (user_id, target_key),
        ).fetchone()
        return dict(row) if row else None


def list_reviews_for_target(target_key: str) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT r.id, r.user_id, u.username, r.judgement, r.reason, r.reason_text, r.created_at, r.updated_at
               FROM reviews r JOIN users u ON u.id = r.user_id
               WHERE r.target_key = ?
               ORDER BY r.updated_at DESC""",
            (target_key,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_all_user_reviews(user_id: int) -> List[Dict[str, Any]]:
    """Tutte le review di un utente, per popolare i badge nella lista."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT target_key, judgement, reason, reason_text, updated_at FROM reviews WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_review(user_id: int, target_key: str, judgement: str,
                  reason: Optional[str] = None, reason_text: Optional[str] = None) -> Dict[str, Any]:
    # Per "ok" non si conserva motivazione
    if judgement == "ok":
        reason, reason_text = None, None
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM reviews WHERE user_id = ? AND target_key = ?", (user_id, target_key)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE reviews SET judgement = ?, reason = ?, reason_text = ?, updated_at = datetime('now') WHERE id = ?",
                (judgement, reason, reason_text, existing["id"]),
            )
            rid = existing["id"]
        else:
            cur = conn.execute(
                "INSERT INTO reviews(user_id, target_key, judgement, reason, reason_text) VALUES (?, ?, ?, ?, ?)",
                (user_id, target_key, judgement, reason, reason_text),
            )
            rid = int(cur.lastrowid)
        row = conn.execute(
            "SELECT id, judgement, reason, reason_text, created_at, updated_at FROM reviews WHERE id = ?", (rid,)
        ).fetchone()
        return dict(row)


def delete_review(user_id: int, target_key: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM reviews WHERE user_id = ? AND target_key = ?", (user_id, target_key))


def list_all_reviews_export() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT r.id, r.target_key, u.username, r.judgement, r.reason, r.reason_text, r.created_at, r.updated_at
               FROM reviews r JOIN users u ON u.id = r.user_id
               ORDER BY r.updated_at DESC"""
        ).fetchall()
    return [dict(r) for r in rows]


# ============================== comments (thread) ==============================

def list_comments_for_target(target_key: str) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.user_id, u.username, c.body, c.created_at, c.updated_at
               FROM comments c JOIN users u ON u.id = c.user_id
               WHERE c.target_key = ?
               ORDER BY c.created_at ASC""",
            (target_key,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_all_comments_export() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.target_key, u.username, c.body, c.created_at, c.updated_at
               FROM comments c JOIN users u ON u.id = c.user_id
               ORDER BY c.created_at ASC"""
        ).fetchall()
    return [dict(r) for r in rows]


def create_comment(user_id: int, target_key: str, body: str) -> Dict[str, Any]:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO comments(user_id, target_key, body) VALUES (?, ?, ?)",
            (user_id, target_key, body),
        )
        cid = int(cur.lastrowid)
        row = conn.execute(
            """SELECT c.id, c.user_id, u.username, c.body, c.created_at, c.updated_at
               FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?""",
            (cid,),
        ).fetchone()
        return dict(row)


def update_comment(comment_id: int, user_id: int, *, body: str, is_admin: bool = False) -> bool:
    """Aggiorna se l'utente è l'autore (o admin). Ritorna True se modificato."""
    with get_conn() as conn:
        if is_admin:
            conn.execute("UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?", (body, comment_id))
            return True
        cur = conn.execute(
            "UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
            (body, comment_id, user_id),
        )
        return cur.rowcount > 0


def delete_comment(comment_id: int, user_id: int, *, is_admin: bool = False) -> bool:
    with get_conn() as conn:
        if is_admin:
            cur = conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
        else:
            cur = conn.execute("DELETE FROM comments WHERE id = ? AND user_id = ?", (comment_id, user_id))
        return cur.rowcount > 0


# ============================== stats (admin) ==============================

def admin_stats() -> Dict[str, Any]:
    with get_conn() as conn:
        users_total = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        users_active = conn.execute("SELECT COUNT(*) c FROM users WHERE active = 1").fetchone()["c"]
        cases_total = conn.execute("SELECT COUNT(*) c FROM test_cases").fetchone()["c"]
        cases_shared = conn.execute("SELECT COUNT(*) c FROM test_cases WHERE shared = 1").fetchone()["c"]
        reviews_total = conn.execute("SELECT COUNT(*) c FROM reviews").fetchone()["c"]
        comments_total = conn.execute("SELECT COUNT(*) c FROM comments").fetchone()["c"]
        by_judgement = {r["judgement"]: r["c"] for r in conn.execute("SELECT judgement, COUNT(*) c FROM reviews GROUP BY judgement")}
        per_user = [dict(r) for r in conn.execute(
            """SELECT u.id, u.username, u.role, u.active,
                      (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) AS reviews,
                      (SELECT COUNT(*) FROM test_cases tc WHERE tc.owner_id = u.id) AS cases,
                      (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments
               FROM users u ORDER BY u.id"""
        )]
    return {
        "users": {"total": users_total, "active": users_active},
        "cases":  {"total": cases_total, "shared": cases_shared},
        "reviews": {"total": reviews_total, "by_judgement": by_judgement},
        "comments": {"total": comments_total},
        "per_user": per_user,
    }
