"""
Tangible Lab — motore del Check-up Vittoria.

Carica il file `checkup/data.json` (estratto dall'Excel "LOGICHE QUESTIONARIO VCT")
con domande, risposte e matrice di mapping risposta→bisogno assicurativo.

L'algoritmo di calcolo è **MAX**: per ogni bisogno assicurativo, il livello
finale è il più alto tra i contributi delle risposte selezionate.
Scala: alto > medio > basso > (nessun bisogno).

Espone:
    load_data() → dict
    compute(answers: dict) → {need_id: 'alto'|'medio'|'basso'}
        answers = { question_id: answer_id (str) | [answer_ids] }
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Union


_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkup", "data.json")
_DATA: Optional[Dict[str, Any]] = None
_LEVEL_RANK = {"basso": 1, "medio": 2, "alto": 3}
_RANK_TO_LEVEL = {1: "basso", 2: "medio", 3: "alto"}


def load_data() -> Dict[str, Any]:
    """Carica (e cache) la struttura dati del checkup."""
    global _DATA
    if _DATA is None:
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            _DATA = json.load(f)
    return _DATA


def _flatten_answer_lookup() -> Dict[str, Dict[str, str]]:
    """Restituisce { question_id+answer_id: {need_id: level} } per lookup veloce."""
    data = load_data()
    out: Dict[str, Dict[str, str]] = {}
    for q in data["questions"]:
        for a in q["answers"]:
            key = f'{q["id"]}.{a["id"]}'
            needs = a.get("needs") or {}
            if needs:
                out[key] = needs
    return out


# Cache lookup precomputato
_LOOKUP: Optional[Dict[str, Dict[str, str]]] = None
def _lookup() -> Dict[str, Dict[str, str]]:
    global _LOOKUP
    if _LOOKUP is None:
        _LOOKUP = _flatten_answer_lookup()
    return _LOOKUP


AnswerVal = Union[str, List[str]]


def compute(answers: Dict[str, AnswerVal]) -> Dict[str, Any]:
    """
    Input:
        answers = {question_id: answer_id_str | [answer_id_str, ...]}
    Output:
        {
            "levels": {need_id: 'alto'|'medio'|'basso'},   # solo bisogni rilevati
            "contributions": [                              # tracing: chi ha spinto quale need
                {"question_id":..., "answer_id":..., "needs": {need_id: level}}
            ],
            "answers_count": int
        }
    """
    lookup = _lookup()
    levels_rank: Dict[str, int] = {}
    contributions: List[Dict[str, Any]] = []
    n_answered = 0

    for qid, val in (answers or {}).items():
        if val is None or val == "" or val == []:
            continue
        ans_list = val if isinstance(val, list) else [val]
        for aid in ans_list:
            if not aid:
                continue
            n_answered += 1
            key = f"{qid}.{aid}"
            needs = lookup.get(key)
            if not needs:
                continue
            contributions.append({"question_id": qid, "answer_id": aid, "needs": dict(needs)})
            for need_id, lvl in needs.items():
                r = _LEVEL_RANK.get(str(lvl).lower(), 0)
                if r > levels_rank.get(need_id, 0):
                    levels_rank[need_id] = r

    levels = {nid: _RANK_TO_LEVEL[r] for nid, r in levels_rank.items() if r > 0}
    return {"levels": levels, "contributions": contributions, "answers_count": n_answered}


def validate_answers(answers: Dict[str, AnswerVal]) -> List[str]:
    """Ritorna lista di errori (vuota se OK)."""
    data = load_data()
    q_by_id = {q["id"]: q for q in data["questions"]}
    errors = []
    for qid, val in (answers or {}).items():
        q = q_by_id.get(qid)
        if not q:
            errors.append(f"Domanda sconosciuta: {qid}")
            continue
        ids = {a["id"] for a in q["answers"]}
        vals = val if isinstance(val, list) else [val]
        if q["type"] != "multi" and len(vals) > 1:
            errors.append(f"{qid}: ammessa una sola risposta, ne sono state inviate {len(vals)}")
        for v in vals:
            if v and v not in ids:
                errors.append(f"{qid}: risposta '{v}' non valida")
    return errors
