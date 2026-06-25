# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NBA Studio: a testing/review environment ("Tangible Lab") built by Tangible around a proprietary **NBA (Next Best Action) engine** owned by the client **Vittoria Assicurazioni**. The engine scores insurance clients/leads and recommends actions. The Lab adds saved test cases, reviews/comments, an admin panel, and a "Check-up" needs-assessment simulator. In modalità normale include anche autenticazione multi-utente, ma la distribuzione attuale è **single-user offline** (flag `TANGIBLE_LAB_SINGLE_USER`).

## Hard constraint: the backend is supplied by the client's IT

Everything outside `tangible_lab/` is **provided by Vittoria's IT department and may be overwritten wholesale at any time** when they ship a new version. It is read-only vendored code. **Never modify**:

- `nba_api.py`, `nba_engine.py`, `nba_config.py`, `nba_catalog.py`
- `dataset.json`, `generate_dataset.py`, `nba_config.json`, `trigger_catalog_*.json`
- `static/` (client UI), `build_all.bat`, `*.spec`

**All work happens in `tangible_lab/`.** Never make a feature depend on a change to client files — if a behavior of the backend needs adjusting, wrap/extend it from `tangible_lab/server.py` instead (see the path-reassignment and breakdown patterns below). After a client update, the only check needed is that the engine internals imported by `server.py` still exist.

## Running

```bash
python tangible_lab/server.py    # full app: client backend + Lab at http://127.0.0.1:8000/lab/
python nba_api.py                # client backend only (no Lab)
```

Uses the venv at `.venv/`. No build step (frontend is vanilla JS), no test suite, no linter configured. Auto-picks the next free port if 8000 is busy, and auto-opens the browser.

Bootstrap login on a fresh DB: `admin` / `admin` (deleting `tangible_lab/tangible_lab.db` resets everything).

## Architecture

`tangible_lab/server.py` (~900 lines, the only Lab entrypoint) **imports `nba_api:app` and extends it in place** — no proxying, one process:

1. **Persistence redirect**: if `$TANGIBLE_LAB_DATA_DIR` is set, seeds the mutable files (`dataset.json`, `nba_config.json`, `trigger_catalog_overrides.json`) into that dir once, then **reassigns the imported modules' path globals** (`nba_api.DATASET_PATH`, `nba_config.CONFIG_JSON_PATH`, `nba_catalog.OVERRIDES_PATH`) so the client backend reads/writes the persistent volume without being modified.
2. **Lockdown middleware**: every path not in the allowlist (`/lab/*`, `/nba/*`, `/config*`, `/catalog/*`, `/dataset/*`, `/favicon.ico`) redirects to `/lab/`. The original Vittoria UI (`/` and `/static/*`) is reachable only by logged-in users.
3. **Lab endpoints**: `/lab/api/*` (auth, cases, reviews, comments, checkup), `/lab/admin/*` (role=admin; users CRUD, stats, multi-sheet Excel export via openpyxl), `/lab/breakdown/{client,lead}` (score breakdowns).
4. The `/lab` static mount happens **at the end of server.py**, deliberately, so it doesn't shadow the `/lab/api/*` routes. Keep new routes above it.

**Coupling points with the client engine** (verify after every IT update):
- `server.py` imports `nba_engine` internals directly (`detect_client_triggers`, `client_urgency_score`, `client_value_score`, etc.) to build the client breakdown.
- `lab_breakdown_lead` **re-implements the lead scoring tables inline** (urgency/value/timing thresholds copied from the engine) — if IT changes lead scoring, this drifts silently.
- `studio.js` contains `CLIENT_SCHEMA`/`LEAD_SCHEMA` form definitions mirroring the engine's expected JSON record shape — also maintained by hand.

Other pieces (all in `tangible_lab/`):

- **`db.py`** — SQLite (`tangible_lab.db`, gitignored, WAL, global RLock), schema created/migrated additively at boot. Tables: `users`, `sessions`, `test_cases`, `reviews`, `comments`, `checkup_cases`. Reviews/comments attach to a `target_key` string: `predef:client:C001` (dataset records) or `case:<id>` (saved cases); one review per (user, target), judgement `ok|ko|unsure`. Path overridable via `TANGIBLE_LAB_DB` / `TANGIBLE_LAB_DATA_DIR`.
- **`auth.py`** — bcrypt passwords; server-side sessions (12h TTL) with the session id signed via `itsdangerous` in the `tl_sid` cookie. Secret from `TANGIBLE_LAB_SECRET` or auto-generated into `.secret`. Guards: `require_user` / `require_admin`. Roles: `admin` | `tester`; `must_change_password` flow for new users.
- **`models.py`** — all SQL lives here (users, cases with own+shared visibility, reviews, comments, admin stats). Endpoints in `server.py` never touch SQL directly.
- **`checkup_engine.py`** — Check-up simulator: loads `checkup/data.json` (extracted from the Excel in `_docs/`), computes need levels with a **MAX algorithm** (alto > medio > basso). Demo cases auto-seeded at boot from `checkup/seed_cases.json` (idempotent; admin can re-seed).
- **`static/`** — vanilla JS, no framework, no build. `studio.js` (~2400 lines) is the main 3-pane mail-client-style UI; plus `admin.js`, `checkup.js`, `login.html`. SheetJS bundled locally in `lib/` for Excel import/export. Per-user UI state (saved snapshots, review filters, sidebar) lives in browser `localStorage` under `nba.lab.*` keys — documented in `tangible_lab/README.md`.

The client engine itself (`nba_engine.py`) is pure functions: dataclasses `Client`/`Lead`, trigger detection, scoring dimensions (urgency/value/opportunity/recency), strategic category, action + channel selection. Its spec lives in `MD/` (`NBA_Algorithm_Spec.md`, `JSON_SCHEMA.md`, `REGEN_GUIDE.md`).

## Deploy

Distribuzione **offline su Windows**: eseguibile `NBAStudio.exe` generato con PyInstaller (spec in `tangible_lab/nba_studio.spec`, script di build in `tangible_lab/build_windows.bat`). Ogni tester riceve una copia dell'`.exe`; doppio click apre il browser su `http://127.0.0.1:8000/lab/`. I dati (DB, dataset, config) risiedono in `%APPDATA%\NBAStudio` sul PC locale — nessun dato sensibile in cloud né in git.

Modalità **single-user locale**: il flag `TANGIBLE_LAB_SINGLE_USER=1` (impostato automaticamente da `desktop_main.py`) disabilita il login e considera l'utente sempre autenticato come admin. Non ci sono ruoli/condivisione: ogni installazione è isolata. Per condividere i risultati si usa l'**export Excel** dal pannello Admin.

Il dataset reale (clienti/lead Vittoria) viene importato localmente tramite il pannello Admin → "Importa dataset"; non deve mai essere committato in git.

Procedura completa in `tangible_lab/DISTRIBUZIONE_WINDOWS.md`. Il repo deve restare **privato** (motore Vittoria proprietario).

Key env vars: `TANGIBLE_LAB_DATA_DIR`, `TANGIBLE_LAB_SECRET`, `TANGIBLE_LAB_SINGLE_USER`.

## Conventions

- Working language is **Italian**: commit messages, code comments, docs, and all UI copy.
- Never commit `tangible_lab/tangible_lab.db*` or `tangible_lab/.secret` (user data and secrets; already gitignored).
- `OLD/` holds archived zips of previous versions — ignore it.
