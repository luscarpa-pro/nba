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
from threading import RLock
from typing import Any, Dict, List, Optional

# ============================================================
# Trigger Catalog (base + user overrides)
# Base catalog is stored in a separate JSON file bundled with the app.
# User overrides are stored next to the executable.
# ============================================================

def _app_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def _bundle_dir() -> str:
    # PyInstaller onefile exposes resources in sys._MEIPASS
    return getattr(sys, "_MEIPASS", _app_dir())


BASE_CATALOG_PATH = os.path.join(_bundle_dir(), "trigger_catalog_base.json")
OVERRIDES_PATH = os.path.join(_app_dir(), "trigger_catalog_overrides.json")

_lock = RLock()

ALLOWED_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
_ALLOWED_FIELDS = {"enabled", "display_name", "severity", "display_order", "payload_schema", "threshold_refs"}


def load_base_catalog() -> Dict[str, Any]:
    with _lock:
        try:
            with open(BASE_CATALOG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("Base catalog must be a JSON object")
            data.setdefault("client", {})
            data.setdefault("lead", {})
            return data
        except Exception:
            # Defensive fallback (minimal empty catalog)
            return {"catalog_version": "0.0.0", "client": {}, "lead": {}}


def load_overrides(path: str = OVERRIDES_PATH) -> Dict[str, Any]:
    with _lock:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {"client": {}, "lead": {}}
            data.setdefault("client", {})
            data.setdefault("lead", {})
            if not isinstance(data.get("client"), dict):
                data["client"] = {}
            if not isinstance(data.get("lead"), dict):
                data["lead"] = {}
            return data
        except FileNotFoundError:
            return {"client": {}, "lead": {}}
        except Exception:
            return {"client": {}, "lead": {}}


def save_overrides(data: Dict[str, Any], path: str = OVERRIDES_PATH) -> None:
    with _lock:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def validate_overrides(overrides: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    if not isinstance(overrides, dict):
        return {"errors": ["Overrides must be a JSON object"], "warnings": []}

    thresholds = (cfg.get("thresholds", {}) if isinstance(cfg, dict) else {})

    for sc in ("client", "lead"):
        if sc not in overrides:
            continue
        if not isinstance(overrides.get(sc), dict):
            errors.append(f"overrides.{sc} must be an object")
            continue

        for code, node in overrides[sc].items():
            if not isinstance(code, str) or not code:
                errors.append(f"Invalid trigger code in overrides.{sc}")
                continue
            if not isinstance(node, dict):
                errors.append(f"overrides.{sc}.{code} must be an object")
                continue

            for k in node.keys():
                if k not in _ALLOWED_FIELDS:
                    warnings.append(f"Unknown field overrides.{sc}.{code}.{k} (ignored)")

            if "enabled" in node and not isinstance(node["enabled"], bool):
                errors.append(f"overrides.{sc}.{code}.enabled must be boolean")

            if "display_name" in node and not isinstance(node["display_name"], str):
                errors.append(f"overrides.{sc}.{code}.display_name must be string")

            if "severity" in node:
                if not isinstance(node["severity"], str):
                    errors.append(f"overrides.{sc}.{code}.severity must be string")
                elif node["severity"].upper() not in ALLOWED_SEVERITIES:
                    errors.append(f"overrides.{sc}.{code}.severity must be one of {ALLOWED_SEVERITIES}")

            if "display_order" in node and not isinstance(node["display_order"], int):
                errors.append(f"overrides.{sc}.{code}.display_order must be integer")

            if "payload_schema" in node and not isinstance(node["payload_schema"], dict):
                errors.append(f"overrides.{sc}.{code}.payload_schema must be an object")

            if "threshold_refs" in node:
                if (not isinstance(node["threshold_refs"], list)) or (not all(isinstance(x, str) for x in node["threshold_refs"])):
                    errors.append(f"overrides.{sc}.{code}.threshold_refs must be an array of strings")
                else:
                    for thr in node["threshold_refs"]:
                        if thresholds and thr not in thresholds:
                            warnings.append(f"overrides.{sc}.{code}.threshold_refs references missing cfg.thresholds.{thr}")

    return {"errors": errors, "warnings": warnings}


def resolve_catalog(cfg: Dict[str, Any]) -> Dict[str, Any]:
    base = load_base_catalog()
    overrides = load_overrides()
    v = validate_overrides(overrides, cfg=cfg)
    thresholds = cfg.get("thresholds", {}) if isinstance(cfg, dict) else {}

    def merge_scope(sc: str) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        base_scope = base.get(sc, {}) if isinstance(base, dict) else {}
        ov_scope = overrides.get(sc, {}) if isinstance(overrides, dict) else {}

        # base entries
        for code, b in base_scope.items():
            node = dict(b)
            node["enabled"] = bool(b.get("default_enabled", True))
            node.pop("default_enabled", None)

            ovr = ov_scope.get(code)
            if isinstance(ovr, dict):
                if "enabled" in ovr:
                    node["enabled"] = bool(ovr["enabled"])
                if "display_name" in ovr:
                    node["display_name"] = ovr["display_name"]
                if "severity" in ovr:
                    node["severity"] = str(ovr["severity"]).upper()
                if "display_order" in ovr:
                    node["display_order"] = int(ovr["display_order"])
                if "payload_schema" in ovr and isinstance(ovr["payload_schema"], dict):
                    node["payload_schema"] = ovr["payload_schema"]
                if "threshold_refs" in ovr and isinstance(ovr["threshold_refs"], list):
                    node["threshold_refs"] = ovr["threshold_refs"]

            tr = node.get("threshold_refs", [])
            node["threshold_values"] = {k: thresholds.get(k) for k in tr} if isinstance(tr, list) else {}
            node["doc_only"] = False
            out[code] = node

        # doc-only
        for code, ovr in ov_scope.items():
            if code in out:
                continue
            if not isinstance(ovr, dict):
                continue
            node = {
                "enabled": bool(ovr.get("enabled", False)),
                "display_name": str(ovr.get("display_name", code)),
                "severity": str(ovr.get("severity", "LOW")).upper(),
                "display_order": int(ovr.get("display_order", 9999)) if isinstance(ovr.get("display_order", 9999), int) else 9999,
                "payload_schema": ovr.get("payload_schema", {}) if isinstance(ovr.get("payload_schema", {}), dict) else {},
                "threshold_refs": ovr.get("threshold_refs", []) if isinstance(ovr.get("threshold_refs", []), list) else [],
                "threshold_values": {},
                "doc_only": True,
            }
            tr = node.get("threshold_refs", [])
            node["threshold_values"] = {k: thresholds.get(k) for k in tr} if isinstance(tr, list) else {}
            out[code] = node

        return out

    return {
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "catalog_version": base.get("catalog_version", "0.0.0"),
        "client": merge_scope("client"),
        "lead": merge_scope("lead"),
        "overrides": overrides,
        "validation": v,
        "overrides_path": OVERRIDES_PATH,
        "base_catalog_path": BASE_CATALOG_PATH,
    }


def is_trigger_enabled(scope: str, trigger_code: str) -> bool:
    base = load_base_catalog().get(scope, {})
    default_enabled = True
    if isinstance(base, dict) and trigger_code in base:
        default_enabled = bool(base[trigger_code].get("default_enabled", True))

    overrides = load_overrides().get(scope, {})
    if isinstance(overrides, dict) and trigger_code in overrides and isinstance(overrides[trigger_code], dict) and "enabled" in overrides[trigger_code]:
        return bool(overrides[trigger_code]["enabled"])

    # doc-only defaults to disabled
    if isinstance(base, dict) and trigger_code not in base and isinstance(overrides, dict) and trigger_code in overrides:
        return bool(overrides[trigger_code].get("enabled", False))

    return default_enabled


def filter_enabled_triggers(triggers: Dict[str, Any], scope: str) -> Dict[str, Any]:
    if not isinstance(triggers, dict):
        return {}
    return {k: v for k, v in triggers.items() if is_trigger_enabled(scope, k)}
