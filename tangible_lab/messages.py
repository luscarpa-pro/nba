"""Overlay 'messaggi rivisti': rimappa il testo recommended_action del motore (read-only)
nei testi rivisti forniti dal cliente. Fonte dati: messages_revised.json.
Logica speculare a reviseMessage() in static/studio.js."""
import json
import os
import re
from functools import lru_cache

_HERE = os.path.dirname(os.path.abspath(__file__))
MAP_PATH = os.path.join(_HERE, "messages_revised.json")

# Categorie le cui azioni concatenano "leve" col separatore em-dash " — ".
_SPLIT_CATEGORIES = {"CROSS_SELL", "VIVA", "CHECKUP"}
_BLOCK_SEP = " — "  # spazio, em-dash, spazio

# token -> frammento regex (in gruppo di cattura)
_TOKENS = {
    "PRODOTTO": r"(.+?)",
    "PREMIO": r"([\d.,]+)",
    "N": r"(\d+)",
    "CAMPAGNA": r"(.+?)",
    "NEAR": r"(\d+)",
    "OLD": r"(\d+)",
}
_TOKEN_RE = re.compile(r"\{([A-Z]+)\}")


@lru_cache(maxsize=1)
def load_map():
    with open(MAP_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    compiled = []
    for entry in raw:
        tokens = _TOKEN_RE.findall(entry["match"])  # ordine di apparizione
        # costruisce la regex: escape dei letterali, sostituzione dei token col frammento
        pattern = _TOKEN_RE.sub(lambda m: _TOKENS.get(m.group(1), re.escape(m.group(0))),
                                _escape_literals(entry["match"]))
        compiled.append({
            "category": entry.get("category"),
            "regex": re.compile("^" + pattern + "$"),
            "tokens": tokens,
            "revised": entry["revised"],
        })
    return compiled


def _escape_literals(template: str) -> str:
    """Esegue re.escape sulle sole parti letterali, lasciando intatti i {TOKEN}."""
    out = []
    last = 0
    for m in _TOKEN_RE.finditer(template):
        out.append(re.escape(template[last:m.start()]))
        out.append(m.group(0))  # {TOKEN} intatto, sostituito dopo
        last = m.end()
    out.append(re.escape(template[last:]))
    return "".join(out)


def _revise_one(category, text):
    """Rimappa una singola stringa (un segmento). Ritorna il testo invariato se nessun match."""
    for entry in load_map():
        if entry["category"] is not None and entry["category"] != category:
            continue
        m = entry["regex"].match(text)
        if not m:
            continue
        values = dict(zip(entry["tokens"], m.groups()))
        return _TOKEN_RE.sub(lambda mm: values.get(mm.group(1), mm.group(0)), entry["revised"])
    return text


def revise(category, text):
    """Rimappa recommended_action al testo rivisto. Per CROSS_SELL/VIVA/CHECKUP spezza i
    segmenti concatenati su ' — ' e li rimappa singolarmente. Fallback: testo invariato."""
    if not text:
        return text
    if category in _SPLIT_CATEGORIES and _BLOCK_SEP in text:
        return _BLOCK_SEP.join(_revise_one(category, seg) for seg in text.split(_BLOCK_SEP))
    return _revise_one(category, text)
