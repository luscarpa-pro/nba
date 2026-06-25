"""
------------------------------------------------------------------------------------------------------------
LICENSE NOTE

This file is part of the NBA engine project, developed for Vittoria Assicurazioni spa. It is provided under 
a proprietary license and is intended for internal use only. 
Unauthorized distribution, reproduction, or use of this code is strictly prohibited. 
For inquiries about licensing or usage, please contact the project maintainers at Vittoria Assicurazioni spa.
------------------------------------------------------------------------------------------------------------
"""

import os
import sys
import json
import time
import threading
import webbrowser
import socket
import hashlib
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from nba_engine import generate_client_nba, generate_lead_nba
from nba_config import CONFIG_JSON_PATH, reload_config, temporary_config
from nba_catalog import resolve_catalog, save_overrides, validate_overrides, OVERRIDES_PATH

app = FastAPI(title="NBA API")

# ----------------- Path helpers (portable + PyInstaller onefile) -----------------

def app_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def resource_dir(rel: str) -> str:
    base = getattr(sys, "_MEIPASS", app_dir())
    return os.path.join(base, rel)


STATIC_DIR = resource_dir("static")
DATASET_PATH = os.path.join(app_dir(), "dataset.json")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", include_in_schema=False)
def home_page():
    return FileResponse(os.path.join(STATIC_DIR, "home.html"))

# ----------------- Dataset loading (portable + lazy) -----------------

_DATA = None
_DATA_LOCK = threading.Lock()


def load_dataset() -> Dict[str, Any]:
    global _DATA
    if _DATA is not None:
        return _DATA
    with _DATA_LOCK:
        if _DATA is not None:
            return _DATA
        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                _DATA = json.load(f)
        except FileNotFoundError:
            _DATA = {"clients": [], "leads": []}
        except Exception:
            _DATA = {"clients": [], "leads": []}
        return _DATA


@app.post("/dataset/reload")
def dataset_reload():
    global _DATA
    with _DATA_LOCK:
        _DATA = None
    load_dataset()
    return {"status": "ok", "dataset_path": DATASET_PATH}

# ----------------- NBA endpoints -----------------

@app.get("/nba/client/")
def nba_client(client_id: str):
    data = load_dataset()
    c = next((x for x in data.get("clients", []) if x.get("client_id") == client_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    res = generate_client_nba(c)
    if not res:
        raise HTTPException(status_code=204, detail="No NBA")
    return res


@app.get("/nba/lead/")
def nba_lead(lead_id: str):
    data = load_dataset()
    l = next((x for x in data.get("leads", []) if x.get("lead_id") == lead_id), None)
    if not l:
        raise HTTPException(status_code=404, detail="Lead not found")
    res = generate_lead_nba(l)
    if not res:
        raise HTTPException(status_code=204, detail="No NBA")
    return res


@app.get("/nba/clients")
def nba_first_n_clients(n: int = 10):
    data = load_dataset()
    clients = data.get("clients", [])
    n = max(1, min(n, len(clients))) if clients else 0
    out = []
    for c in clients[:n]:
        nba = generate_client_nba(c)
        out.append({
            "client_id": c.get("client_id"),
            "priority_score": (nba.get("priority_score") if nba else None),
            "priority_tier": (nba.get("priority_tier") if nba else None),
            "strategic_category": (nba.get("strategic_category") if nba else None),
            "presentation_mode": (nba.get("presentation_mode") if nba else None),
            "client_json": c,
            "nba": (nba.get("recommended_actions") if nba else []),
        })
    return out


@app.get("/nba/leads")
def nba_first_n_leads(n: int = 10):
    data = load_dataset()
    leads = data.get("leads", [])
    n = max(1, min(n, len(leads))) if leads else 0
    out = []
    for l in leads[:n]:
        nba = generate_lead_nba(l)
        out.append({
            "lead_id": l.get("lead_id"),
            "priority_score": (nba.get("priority_score") if nba else None),
            "priority_tier": (nba.get("priority_tier") if nba else None),
            "strategic_category": (nba.get("strategic_category") if nba else None),
            "presentation_mode": (nba.get("presentation_mode") if nba else None),
            "lead_json": l,
            "nba": (nba.get("recommended_actions") if nba else []),
        })
    return out


@app.post("/nba/client/test")
def nba_client_test(payload: dict = Body(...), debug: bool = False):
    res = generate_client_nba(payload, debug=debug)
    if not res:
        raise HTTPException(status_code=204, detail="No NBA")
    return res


@app.post("/nba/lead/test")
def nba_lead_test(payload: dict = Body(...), debug: bool = False):
    res = generate_lead_nba(payload)
    if not res:
        raise HTTPException(status_code=204, detail="No NBA")
    return res

# ----------------- Config endpoints -----------------

@app.get("/config")
def get_config():
    try:
        with open(CONFIG_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot read config: {e}")


def _round_to_step(v: float, step: float) -> float:
    try:
        step = float(step)
    except Exception:
        return v
    if step <= 0:
        return v
    return round(v / step) * step


def _normalize_weight_section(cfg_schema: dict, section_name: str) -> None:
    """Normalize section.*.value so the sum is 1.0 (best-effort, keeps min/max/step)."""
    sec = cfg_schema.get(section_name)
    if not isinstance(sec, dict):
        return
    keys = [k for k,v in sec.items() if isinstance(v, dict) and "value" in v]
    if not keys:
        return

    vals = []
    for k in keys:
        node = sec[k]
        try:
            vals.append(float(node.get("value", 0.0)))
        except Exception:
            vals.append(0.0)

    s = sum(vals)
    if s <= 0:
        # distribute equally
        eq = 1.0 / float(len(keys))
        for k in keys:
            node = sec[k]
            mn = float(node.get("min", 0.0))
            mx = float(node.get("max", 1.0))
            st = float(node.get("step", 0.01))
            node["value"] = max(mn, min(mx, _round_to_step(eq, st)))
        return

    # normalize
    norm = [v/s for v in vals]

    # apply rounding/clamping, then adjust last key to keep sum close to 1
    out_vals = []
    for i,k in enumerate(keys):
        node = sec[k]
        mn = float(node.get("min", 0.0))
        mx = float(node.get("max", 1.0))
        st = float(node.get("step", 0.01))
        x = max(mn, min(mx, _round_to_step(norm[i], st)))
        out_vals.append(x)

    if len(keys) > 1:
        # adjust last
        target_last = 1.0 - sum(out_vals[:-1])
        node = sec[keys[-1]]
        mn = float(node.get("min", 0.0))
        mx = float(node.get("max", 1.0))
        st = float(node.get("step", 0.01))
        out_vals[-1] = max(mn, min(mx, _round_to_step(target_last, st)))

    for k,x in zip(keys, out_vals):
        sec[k]["value"] = x


@app.put("/config")
def put_config(cfg: dict = Body(...)):
    try:
        # Normalize weights before saving so UI always shows a sum of 1.0
        _normalize_weight_section(cfg, "client_weights")
        _normalize_weight_section(cfg, "lead_weights")

        with open(CONFIG_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        reload_config()
        return {"status": "ok", "normalized": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ----------------- Preview endpoints (inline config) -----------------

def _flatten_schema_cfg(schema_cfg: dict) -> dict:
    out = {}
    for section, content in (schema_cfg or {}).items():
        if isinstance(content, dict):
            sec = {}
            for k, node in content.items():
                if isinstance(node, dict) and "value" in node:
                    sec[k] = node["value"]
                else:
                    sec[k] = node
            out[section] = sec
        else:
            out[section] = content
    return out


def _cfg_hash(cfg: dict) -> str:
    b = json.dumps(cfg, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    return hashlib.sha256(b).hexdigest()[:12]


@app.post("/nba/client/preview")
def nba_client_preview(body: dict = Body(...), debug: bool = False):
    client = body.get("client")
    cfg_schema = body.get("config")
    if not isinstance(client, dict) or not isinstance(cfg_schema, dict):
        raise HTTPException(status_code=400, detail="Body must include {client:<obj>, config:<obj>}")

    # IMPORTANT: normalize weight sections also for preview, so behavior matches what gets saved
    _normalize_weight_section(cfg_schema, "client_weights")
    _normalize_weight_section(cfg_schema, "lead_weights")

    cfg_flat = _flatten_schema_cfg(cfg_schema)
    with temporary_config(cfg_flat):
        out = generate_client_nba(client, debug=debug)

    if not out:
        raise HTTPException(status_code=204, detail="No NBA")

    if isinstance(out, dict):
        out["__config_hash"] = _cfg_hash(cfg_flat)
    return out


@app.post("/nba/lead/preview")
def nba_lead_preview(body: dict = Body(...), debug: bool = False):
    lead = body.get("lead")
    cfg_schema = body.get("config")
    if not isinstance(lead, dict) or not isinstance(cfg_schema, dict):
        raise HTTPException(status_code=400, detail="Body must include {lead:<obj>, config:<obj>}")

    _normalize_weight_section(cfg_schema, "client_weights")
    _normalize_weight_section(cfg_schema, "lead_weights")

    cfg_flat = _flatten_schema_cfg(cfg_schema)
    with temporary_config(cfg_flat):
        out = generate_lead_nba(lead)

    if not out:
        raise HTTPException(status_code=204, detail="No NBA")

    if isinstance(out, dict):
        out["__config_hash"] = _cfg_hash(cfg_flat)
    return out

# ----------------- Trigger Catalog API -----------------

@app.get("/catalog/triggers")
def get_trigger_catalog():
    cfg = reload_config()
    return resolve_catalog(cfg)


@app.post("/catalog/triggers/validate")
def validate_trigger_catalog(payload: dict = Body(...)):
    cfg = reload_config()
    return validate_overrides(payload, cfg=cfg)


@app.put("/catalog/triggers")
def put_trigger_catalog(payload: dict = Body(...)):
    cfg = reload_config()
    v = validate_overrides(payload, cfg=cfg)
    if v.get("errors"):
        raise HTTPException(status_code=400, detail={"message": "Invalid catalog overrides", "validation": v})

    if not isinstance(payload, dict):
        payload = {}
    payload.setdefault("client", {})
    payload.setdefault("lead", {})

    save_overrides(payload)
    return {"status": "ok", "overrides_path": OVERRIDES_PATH, "validation": v}

# ----------------- Convenience: open browser on start -----------------

def _open_browser(url: str):
    try:
        webbrowser.open(url)
    except Exception:
        pass


def _find_free_port(host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return int(s.getsockname()[1])


def run_server(host: str = "127.0.0.1", port: int = 8000, open_ui: bool = True):
    import uvicorn

    chosen_port = port
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            if s.connect_ex((host, port)) == 0:
                chosen_port = _find_free_port(host)
    except Exception:
        chosen_port = port

    if open_ui:
        threading.Timer(0.6, _open_browser, args=(f"http://{host}:{chosen_port}/",)).start()

    uvicorn.run(app, host=host, port=chosen_port)


if __name__ == "__main__":
    run_server(host="127.0.0.1", port=8000, open_ui=True)
