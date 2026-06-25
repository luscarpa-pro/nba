# Build Guide — How to Regenerate Engine, API, and HTML Pages from Scratch

> This document explains how to regenerate the full solution (engine + API + UI) using the NBA specification.
> It assumes a simple local setup:
> - API: `http://127.0.0.1:8000`
> - UI static server: `http://127.0.0.1:5500`

---

## 1) Target Folder Layout

Create a project folder with this structure:

- `nba_engine.py` — algorithm only
- `nba_api.py` — REST endpoints only
- `nba_config.json` — numeric config schema (values + min/max/step)
- `nba_config.py` — config loader/flatten helpers
- `dataset.json` — dataset (synthetic or real)
- `generate_dataset.py` — synthetic generator
- `ui/`
  - `home.html`
  - `NBA_Index.html`
  - `NBA_test.html`
  - `NBA_config.html`

---

## 2) Regenerate the Engine (`nba_engine.py`)

### 2.1 Responsibilities
The engine file must:
- parse Client/Lead JSON into internal structures
- compute triggers
- compute scoring dimensions
- compute strategic_category
- build action list with primary/secondary marking
- pick channels using preferred-channel + availability + fallback
- return task JSON output

### 2.2 Separation-of-concerns
- Engine must NOT load files from disk (except config access via `nba_config.py`).
- Engine must NOT depend on web frameworks.

### 2.3 Required public functions
- `generate_client_nba(client_dict: dict, debug: bool=False) -> dict|None`
- `generate_lead_nba(lead_dict: dict) -> dict|None`

### 2.4 Debug output
If `debug=True`, include `value_breakdown` for client tasks only.

---

## 3) Regenerate the Config (`nba_config.json` + `nba_config.py`)

### 3.1 `nba_config.json`
- Store each numeric parameter as:
  ```json
  "PARAM": {"value": 12, "min": 0, "max": 100, "step": 1}
  ```
- Organize into sections:
  - `client_weights`, `lead_weights`
  - `tiers`
  - `avg_premiums`
  - `thresholds` (includes new boosts and value normalization caps)

### 3.2 `nba_config.py`
- Implement:
  - `load_config_schema()` (returns schema JSON)
  - `load_config()` (returns flattened numeric config)
  - `get_config()` (thread-safe getter)
- Flatten schema to numeric values so engine reads `cfg[section][param]`.

---

## 4) Regenerate the API (`nba_api.py`)

### 4.1 Responsibilities
API file must:
- load `dataset.json`
- expose endpoints only
- call engine functions
- provide config endpoints for UI
- configure CORS for UI origin (5500)

### 4.2 Endpoints (minimum)
- `GET /nba/client/{client_id}` — lookup in dataset + compute NBA
- `GET /nba/lead/{lead_id}` — lookup in dataset + compute NBA
- `GET /nba/clients?n=N` — first N clients NBA (for bulk table)
- `POST /nba/client/test?debug=bool` — compute NBA from posted client JSON
- `GET /config` — return config schema
- `PUT /config` — validate & save config schema

### 4.3 CORS
Allow:
- `http://127.0.0.1:5500`
- `http://localhost:5500`

---

## 5) Regenerate the HTML Pages (UI)

### 5.1 Shared frontend rules
- Hardcode API base:
  ```js
  const API_BASE = "http://127.0.0.1:8000";
  ```
- Always sort actions PRIMARY-first before rendering:
  - sort by `priority_within_task === "PRIMARY"` or `primary === true`

### 5.2 `home.html`
- Provide navigation links to:
  - `NBA_Index.html`
  - `NBA_test.html`
  - `NBA_config.html`

### 5.3 `NBA_Index.html`
- Single lookup: client_id + lead_id
- Bulk view: first N clients
- Show:
  - score/tier
  - strategic_category
  - presentation_mode
  - actions list with PRIMARY-first ordering

### 5.4 `NBA_test.html`
- Provide editable prototype client JSON via form + tables:
  - base fields
  - policies table add/remove
  - claims/complaints add/remove
  - campaigns and pending_quotes add/remove
  - value driver fields
- “Test” button posts JSON to `POST /nba/client/test`.
- Optional debug checkbox sends `?debug=true`.

### 5.5 `NBA_config.html`
- Load schema from `GET /config`
- Render each numeric parameter with:
  - label
  - description (small font)
  - numeric input
  - slider
  - Save/Cancel

---

## 6) Dataset Generation

### 6.1 `generate_dataset.py`
- Provide CLI options:
  - `--out dataset.json`
  - `--clients 50`
  - `--leads 20`
  - `--seed 42`
- Output a dataset compatible with the JSON schema.

---

## 7) Run Instructions

### 7.1 Install
```bash
pip install fastapi uvicorn
```

### 7.2 Start API (8000)
```bash
python -m uvicorn nba_api:app --reload --port 8000
```

### 7.3 Start UI (5500)
From the `ui/` folder:
```bash
python -m http.server 5500
```

Open:
- `http://127.0.0.1:5500/home.html`

---

## 8) Validation Checklist

- API returns tasks with:
  - `strategic_category`, `presentation_mode`
  - actions include `priority_within_task`
- UI shows PRIMARY first
- `NBA_config.html` can save config schema
- `NBA_test.html` can send JSON and show response

---

*End of build guide.*
