"""CRUD per casi del Check-up Vittoria (tabella checkup_cases)."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .db import get_conn


def _row_to_dict(row) -> Dict[str, Any]:
    d = dict(row)
    try: d["answers"] = json.loads(d.pop("answers_json"))
    except Exception: d["answers"] = {}; d.pop("answers_json", None)
    try: d["result"]  = json.loads(d.pop("result_json"))
    except Exception: d["result"] = {}; d.pop("result_json", None)
    d["shared"] = bool(d.get("shared"))
    return d


def list_visible_to(user_id: int) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.owner_id, u.username AS owner_username,
                      c.name, c.answers_json, c.result_json, c.shared, c.notes,
                      c.created_at, c.updated_at
               FROM checkup_cases c JOIN users u ON u.id = c.owner_id
               WHERE c.owner_id = ? OR c.shared = 1
               ORDER BY c.updated_at DESC""",
            (user_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def list_all() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.owner_id, u.username AS owner_username,
                      c.name, c.answers_json, c.result_json, c.shared, c.notes,
                      c.created_at, c.updated_at
               FROM checkup_cases c JOIN users u ON u.id = c.owner_id
               ORDER BY c.updated_at DESC"""
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get(case_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            """SELECT c.id, c.owner_id, u.username AS owner_username,
                      c.name, c.answers_json, c.result_json, c.shared, c.notes,
                      c.created_at, c.updated_at
               FROM checkup_cases c JOIN users u ON u.id = c.owner_id
               WHERE c.id = ?""",
            (case_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def create(owner_id: int, name: str, answers: dict, result: dict, shared: bool = False, notes: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO checkup_cases(owner_id, name, answers_json, result_json, shared, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (owner_id, name, json.dumps(answers, ensure_ascii=False),
             json.dumps(result, ensure_ascii=False), 1 if shared else 0, notes),
        )
        return int(cur.lastrowid)


def update(case_id: int, *, name: Optional[str] = None, answers: Optional[dict] = None,
           result: Optional[dict] = None, shared: Optional[bool] = None, notes: Optional[str] = None) -> None:
    sets, params = [], []
    if name is not None: sets.append("name = ?"); params.append(name)
    if answers is not None: sets.append("answers_json = ?"); params.append(json.dumps(answers, ensure_ascii=False))
    if result is not None: sets.append("result_json = ?"); params.append(json.dumps(result, ensure_ascii=False))
    if shared is not None: sets.append("shared = ?"); params.append(1 if shared else 0)
    if notes is not None: sets.append("notes = ?"); params.append(notes)
    if not sets: return
    sets.append("updated_at = datetime('now')")
    params.append(case_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE checkup_cases SET {', '.join(sets)} WHERE id = ?", params)


def delete(case_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM checkup_cases WHERE id = ?", (case_id,))
