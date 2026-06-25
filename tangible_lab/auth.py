"""
Auth helper: bcrypt per password, sessioni server-side con id firmato in cookie.

Il cookie 'tl_sid' contiene un session_id casuale firmato (URLSafeSerializer).
La sessione vive in DB (tabella sessions) e scade dopo SESSION_TTL_HOURS.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from itsdangerous import URLSafeSerializer, BadSignature
from fastapi import HTTPException, Request, Response

from .db import get_conn


SECRET = os.environ.get("TANGIBLE_LAB_SECRET")
if not SECRET:
    # Auto-genera un secret persistente. In container preferire /data; in dev accanto al modulo.
    _data_dir = os.environ.get("TANGIBLE_LAB_DATA_DIR")
    _secret_file = (
        os.path.join(_data_dir, ".secret") if _data_dir
        else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".secret")
    )
    if os.path.exists(_secret_file):
        with open(_secret_file, "r", encoding="utf-8") as f:
            SECRET = f.read().strip()
    else:
        SECRET = secrets.token_urlsafe(48)
        os.makedirs(os.path.dirname(_secret_file) or ".", exist_ok=True)
        with open(_secret_file, "w", encoding="utf-8") as f:
            f.write(SECRET)
        try:
            os.chmod(_secret_file, 0o600)
        except Exception:
            pass

SESSION_TTL_HOURS = 12
COOKIE_NAME = "tl_sid"
SECURE_COOKIE = os.environ.get("TANGIBLE_LAB_SECURE_COOKIE", "0") == "1"
_signer = URLSafeSerializer(SECRET, salt="tl-session")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_session(user_id: int) -> str:
    sid = secrets.token_urlsafe(24)
    expires = (datetime.utcnow() + timedelta(hours=SESSION_TTL_HOURS)).isoformat(timespec="seconds")
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(id, user_id, expires_at) VALUES (?, ?, ?)",
            (sid, user_id, expires),
        )
        conn.execute("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", (user_id,))
    return _signer.dumps(sid)


def delete_session(signed_sid: str) -> None:
    try:
        sid = _signer.loads(signed_sid)
    except BadSignature:
        return
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))


def user_from_request(request: Request) -> Optional[dict]:
    # Modalità single-user locale: nessun login, ritorna l'utente admin locale.
    if os.environ.get("TANGIBLE_LAB_SINGLE_USER"):
        with get_conn() as conn:
            row = conn.execute(
                "SELECT id, username, role FROM users WHERE active = 1 AND role = 'admin' ORDER BY id LIMIT 1"
            ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "must_change_password": False,
        }

    signed = request.cookies.get(COOKIE_NAME)
    if not signed:
        return None
    try:
        sid = _signer.loads(signed)
    except BadSignature:
        return None
    with get_conn() as conn:
        row = conn.execute(
            """SELECT u.id, u.username, u.role, u.active, u.must_change_password, s.expires_at
               FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.id = ?""",
            (sid,),
        ).fetchone()
        if not row:
            return None
        # Check expiration
        try:
            exp = datetime.fromisoformat(row["expires_at"])
            if exp < datetime.utcnow():
                conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
                return None
        except Exception:
            return None
        if not row["active"]:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "must_change_password": bool(row["must_change_password"]),
        }


def require_user(request: Request) -> dict:
    u = user_from_request(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u


def require_admin(request: Request) -> dict:
    u = require_user(request)
    if u["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden (admin only)")
    return u


def set_session_cookie(response: Response, signed_sid: str) -> None:
    response.set_cookie(
        COOKIE_NAME, signed_sid,
        max_age=SESSION_TTL_HOURS * 3600,
        httponly=True,
        samesite="lax",
        secure=SECURE_COOKIE,   # True dietro HTTPS (Render/produzione)
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")
