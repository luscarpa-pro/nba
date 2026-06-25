"""
------------------------------------------------------------------------------------------------------------
LICENSE NOTE

This file is part of the NBA engine project, developed for Vittoria Assicurazioni spa. It is provided under 
a proprietary license and is intended for internal use only. 
Unauthorized distribution, reproduction, or use of this code is strictly prohibited. 
For inquiries about licensing or usage, please contact the project maintainers at Vittoria Assicurazioni spa.
------------------------------------------------------------------------------------------------------------
"""

import json
import os
import sys
from contextlib import contextmanager
from threading import RLock

def _runtime_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

CONFIG_JSON_PATH = os.path.join(_runtime_dir(), "nba_config.json")
_lock = RLock()

DEFAULT_CONFIG = {
    "client_weights": {"urgency": 0.35, "value": 0.30, "opportunity": 0.20, "recency": 0.15},
    "lead_weights": {"urgency": 0.45, "value": 0.30, "timing": 0.25},
    "tiers": {"CRITICAL": 95.0, "HIGH": 80.0, "MEDIUM": 50.0},
    "avg_premiums": {
        "CASA": 1700.0,
        "INFORTUNI": 350.0,
        "MALATTIA": 550.0,
        "VITA_PROTEZIONE": 600.0,
        "PREVIDENZA_COMPLEMENTARE": 1200.0,
        "RESPONSABILITA_PROFESSIONALE": 800.0,
        "VITA_PRIVATA_RESPONSABILITA_CIVILE": 150.0,
        "VITA_PRIVATA_ANIMALI_DOMESTICI": 100.0,
        "VITA_PRIVATA_TUTELA_LEGALE": 150.0,
        "VITA_PRIVATA_MICROMOBILITA": 80.0,
        "VITA_PRIVATA_VIAGGI": 90.0,
    },
    "thresholds": {
        "HIGH_CHURN_THRESHOLD": 0.7,
        "SINGLE_POLICY_CHURN_THRESHOLD": 0.3,
        "CHURN_OVERRIDE_RENEWAL_DAYS": 30,
        "NO_CONTACT_DAYS_THRESHOLD": 90,
        "LEAD_NEW_HOURS_THRESHOLD": 48,
        "LEAD_STALE_DAYS_THRESHOLD": 2,
        "LEAD_COVERAGE_START_SOON_DAYS": 14,
        "LEAD_HIGH_VALUE_PREMIUM_THRESHOLD": 500,
        "OPEN_CASE_URGENCY_BOOST": 20,
        "ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST": 15,
        "VIVA_EXPIRING_OPPORTUNITY_BOOST": 20,
        "PENDING_QUOTE_OPPORTUNITY_BOOST": 10,
        "VALUE_TENURE_MAX_YEARS": 25,
        "VALUE_POLICYCOUNT_MAX": 8,
        "VALUE_AGENCY_PROFIT_MAX": 2000,
        "VALUE_COMPANY_SP_MAX": 1.0,
        "VALUE_AUTO_NORM_MAX": 2000,
        "VALUE_NONAUTO_PREM_MAX": 5000,
    },
}

def _flatten(schema_cfg: dict) -> dict:
    """Convert {section:{k:{value,...}}} to {section:{k:value}}; keep non-schema items intact."""
    out = {}
    for section, content in schema_cfg.items():
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

def load_config_schema() -> dict:
    with open(CONFIG_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def load_config() -> dict:
    try:
        return _flatten(load_config_schema())
    except Exception:
        return DEFAULT_CONFIG.copy()

CONFIG = load_config()



@contextmanager
def temporary_config(new_cfg: dict):
    """Temporarily override in-memory CONFIG (thread-safe) and restore after use."""
    global CONFIG
    with _lock:
        old = CONFIG
        CONFIG = new_cfg
        try:
            yield
        finally:
            CONFIG = old

def get_config() -> dict:
    with _lock:
        return CONFIG

def reload_config() -> dict:
    global CONFIG
    with _lock:
        CONFIG = load_config()
        return CONFIG
