# Messaggi rivisti (overlay azioni NBA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare nel Lab i "messaggi rivisti" forniti dal cliente al posto dei testi `recommended_action` del motore, tramite un toggle globale, senza toccare il motore.

**Architecture:** Mappatura dati in un unico JSON (`tangible_lab/messages_revised.json`). Logica di rimappatura speculare in Python (`tangible_lab/messages.py`, per l'export) e JS (`studio.js`, per UI live). Toggle in `localStorage`. Match sui pattern dell'output reale del motore; fallback al testo invariato.

**Tech Stack:** Python (FastAPI/server.py, modulo puro), JS vanilla (studio.js), JSON dati. Nessun build, nessun test runner.

## Global Constraints

- Modificare SOLO file del Lab: `tangible_lab/**` (incl. `tangible_lab/static/**`). MAI file vendored (`nba_engine.py`, `nba_api.py`, `static/` in root, `dataset.json`, ...).
- Lingua **italiana** per copy e commenti.
- Chiavi `localStorage` sotto `nba.lab.*`.
- Fallback sicuro: messaggio non mappato → restituito **invariato** (mai vuoto/None).
- Token→frammento regex (identico in Python e JS): `{PRODOTTO}`→`(.+?)`, `{PREMIO}`→`([\d.,]+)`, `{N}`→`(\d+)`, `{CAMPAGNA}`→`(.+?)`, `{NEAR}`→`(\d+)`, `{OLD}`→`(\d+)`. Match ancorato `^…$`. Mappa token→valore per nome (un token può ripetersi nel `revised`).
- Split per segmenti su ` — ` (U+2014 con spazi) SOLO per categorie `CROSS_SELL`, `VIVA`, `CHECKUP`.
- Commit message in italiano con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Dati mappatura + core Python (`messages_revised.json`, `messages.py`)

**Files:**
- Create: `tangible_lab/messages_revised.json`
- Create: `tangible_lab/messages.py`

**Interfaces:**
- Produces (Python): `tangible_lab.messages.revise(category: str, text: str) -> str`; `load_map() -> list`.
- Consumes: nessuno (modulo puro; legge il JSON dal proprio percorso).

- [ ] **Step 1: Creare `tangible_lab/messages_revised.json` con ESATTAMENTE questo contenuto**

```json
[
  {"category": "PAYMENT", "match": "Gestire insoluto polizza - scaduto da {N} giorni. Rischio cancellazione.", "revised": "Polizza con pagamento scaduto da {N} giorni. Rischio cancellazione: contatta il cliente con urgenza.", "note": "Insoluto >= 45 giorni"},
  {"category": "PAYMENT", "match": "Gestire insoluto polizza - scaduto da {N} giorni.", "revised": "Polizza con pagamento scaduto da {N} giorni. Contatta il cliente per regolarizzare.", "note": "Insoluto < 45 giorni"},

  {"category": "RENEWAL", "match": "Rinnovo urgente {PRODOTTO} - scade oggi (€{PREMIO}/anno)", "revised": "Polizza {PRODOTTO} scade oggi (€{PREMIO}/anno). Rinnova subito.", "note": "Scadenza oggi"},
  {"category": "RENEWAL", "match": "Rinnovo urgente {PRODOTTO} - scadenza tra {N} giorni (€{PREMIO}/anno)", "revised": "Polizza {PRODOTTO} scade tra {N} giorni (€{PREMIO}/anno). Contatta il cliente per il rinnovo.", "note": "Scadenza entro 7 giorni"},
  {"category": "RENEWAL", "match": "Rinnovo {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno) - verificare intenzioni", "revised": "Polizza {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno). Verifica le intenzioni del cliente.", "note": "Scadenza entro 30 giorni"},
  {"category": "RENEWAL", "match": "Rinnovo {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno)", "revised": "Polizza {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno). Pianifica il rinnovo.", "note": "Scadenza entro 14 giorni"},
  {"category": "RENEWAL", "match": "Primo contatto per rinnovo {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno)", "revised": "Polizza {PRODOTTO} in scadenza tra {N} giorni (€{PREMIO}/anno). Primo contatto consigliato.", "note": "Scadenza entro 45 giorni"},

  {"category": "CHURN_PREVENTION", "match": "Rischio abbandono - polizza {PRODOTTO} rischio {N}%", "revised": "Cliente a rischio abbandono ({N}%) sulla polizza {PRODOTTO}. Intervieni per fidelizzare.", "note": "Alto churn, piu' polizze"},
  {"category": "CHURN_PREVENTION", "match": "Attenzione - unica polizza {PRODOTTO} con rischio abbandono {N}%", "revised": "Attenzione: è l'unica polizza del cliente ({PRODOTTO}). Rischio abbandono al {N}%. Priorità alta.", "note": "Alto churn, polizza unica"},
  {"category": "CHURN_PREVENTION", "match": "Rischio abbandono cliente", "revised": "Segnale di abbandono rilevato. Contatta il cliente per capire la situazione.", "note": "Churn generico (fallback)"},

  {"category": "CROSS_SELL", "match": "Proporre polizza Casa - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Casa. Proponila.", "note": "Gap Casa"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Infortuni - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Infortuni. Proponila.", "note": "Gap Infortuni"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Malattia - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Malattia. Proponila.", "note": "Gap Malattia"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Vita Protezione - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Vita Protezione. Proponila.", "note": "Gap Vita Protezione"},
  {"category": "CROSS_SELL", "match": "Proporre soluzione di Previdenza Complementare - gap di copertura rilevato", "revised": "Il cliente non ha una soluzione di Previdenza Complementare. Proponila.", "note": "Gap Previdenza Complementare"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Responsabilità Professionale - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Responsabilità Professionale. Proponila.", "note": "Gap Responsabilita' Professionale"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Responsabilità Civile Vita Privata - gap di copertura rilevato", "revised": "Il cliente non ha una copertura RC Vita Privata. Proponila.", "note": "Gap Resp. Civile Vita Privata"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Animali Domestici - gap di copertura rilevato", "revised": "Il cliente non ha una copertura per animali domestici. Proponila.", "note": "Gap Animali Domestici"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Tutela Legale - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Tutela Legale. Proponila.", "note": "Gap Tutela Legale"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Micromobilità - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Micromobilità. Proponila.", "note": "Gap Micromobilita'"},
  {"category": "CROSS_SELL", "match": "Proporre polizza Viaggi - gap di copertura rilevato", "revised": "Il cliente non ha una copertura Viaggi. Proponila.", "note": "Gap Viaggi"},
  {"category": "CROSS_SELL", "match": "Upgrade polizza Auto - opportunità di upsell rilevata", "revised": "C'è un'opportunità di upgrade sulla polizza Auto. Proponila.", "note": "Upsell Auto (legacy)"},
  {"category": "CROSS_SELL", "match": "Proposta commerciale - opportunità di copertura", "revised": "Opportunità di copertura rilevata. Valuta cosa proporre al cliente.", "note": "Gap generico (fallback)"},

  {"category": "VIVA", "match": "Punti Viva in scadenza: {N} punti - contattare il cliente", "revised": "Il cliente ha {N} punti Viva in scadenza. Contattalo prima che li perda.", "note": "Punti in scadenza"},
  {"category": "VIVA", "match": "Informare su {N} punti VIVA non utilizzati", "revised": "Il cliente ha {N} punti Viva non ancora usati. Informalo dei vantaggi disponibili.", "note": "Saldo alto non riscattato"},
  {"category": "VIVA", "match": "Proporre iscrizione programma VIVA", "revised": "Il cliente non è ancora iscritto al programma Viva. Presentaglielo.", "note": "Non iscritto al programma"},

  {"category": "CHECKUP", "match": "Proporre analisi dei bisogni assicurativi", "revised": "Il cliente non ha ancora fatto il checkup assicurativo. Proponi un'analisi dei bisogni.", "note": "Checkup mai effettuato"},

  {"category": "RELATIONSHIP", "match": "Azione ordinaria: nessuna situazione che richiede attenzione specifica. Valutare contatto di cortesia/manutenzione.", "revised": "Nessuna situazione urgente. Considera un contatto di cortesia per mantenere la relazione.", "note": "Nessun segnale attivo"},
  {"category": "RELATIONSHIP", "match": "Sinistro e reclamo aperti in gestione — verificare stato e contattare il cliente.", "revised": "Il cliente ha un sinistro e un reclamo aperti. Verifica lo stato e contattalo.", "note": "Sinistro e reclamo aperti"},
  {"category": "RELATIONSHIP", "match": "Sinistro aperto in gestione — verificare stato e contattare il cliente.", "revised": "Il cliente ha un sinistro aperto. Verifica lo stato della pratica e contattalo.", "note": "Solo sinistro aperto"},
  {"category": "RELATIONSHIP", "match": "Reclamo aperto in gestione — verificare stato e contattare il cliente.", "revised": "Il cliente ha un reclamo aperto. Verifica lo stato della pratica e contattalo.", "note": "Solo reclamo aperto"},
  {"category": "RELATIONSHIP", "match": "Riprendere contatto - nessuna interazione da {N} giorni", "revised": "Nessun contatto da {N} giorni. È un buon momento per riprendere la relazione.", "note": "Nessun contatto da >90 giorni"},
  {"category": "RELATIONSHIP", "match": "Inviare auguri di compleanno", "revised": "Oggi è il compleanno del cliente. Invia i tuoi auguri.", "note": "Compleanno oggi"},
  {"category": "RELATIONSHIP", "match": "Compleanno tra {N} giorni - buona occasione per un contatto", "revised": "Il compleanno del cliente è tra {N} giorni. Ottima occasione per un contatto.", "note": "Compleanno imminente"},
  {"category": "RELATIONSHIP", "match": "Celebrare anniversario cliente", "revised": "Oggi è l'anniversario del cliente con l'agenzia. Un messaggio di ringraziamento fa la differenza.", "note": "Anniversario cliente"},
  {"category": "RELATIONSHIP", "match": "Mantenere relazione cliente", "revised": "Nessuna azione specifica richiesta. Mantieni la relazione con un contatto periodico.", "note": "Default (fallback)"},

  {"category": "LEAD_CONVERSION", "match": "Finalizzare {PRODOTTO} - copertura richiesta tra {N} giorni", "revised": "Il lead vuole la copertura {PRODOTTO} entro {N} giorni. Finalizza subito il contratto.", "note": "Copertura imminente"},
  {"category": "QUOTE_FOLLOW_UP", "match": "Presentare preventivo {PRODOTTO} €{PREMIO}/anno - alto valore", "revised": "Preventivo {PRODOTTO} disponibile: €{PREMIO}/anno. Lead ad alto valore — contatta con priorità.", "note": "Preventivo alto valore"},
  {"category": "QUOTE_FOLLOW_UP", "match": "Presentare preventivo {PRODOTTO} €{PREMIO}/anno", "revised": "Preventivo {PRODOTTO} disponibile: €{PREMIO}/anno. Contatta il lead per presentarlo.", "note": "Preventivo standard"},
  {"category": "FIRST_CONTACT", "match": "Primo contatto - richiesta {PRODOTTO} ricevuta oggi", "revised": "Richiesta {PRODOTTO} ricevuta oggi. Contatta il lead al più presto.", "note": "Lead ricevuto oggi"},
  {"category": "FIRST_CONTACT", "match": "Primo contatto - richiesta {PRODOTTO} ricevuta ieri", "revised": "Richiesta {PRODOTTO} ricevuta ieri. Contatta il lead oggi.", "note": "Lead ricevuto ieri"},
  {"category": "FIRST_CONTACT", "match": "Primo contatto - richiesta {PRODOTTO} ricevuta {N} ore fa", "revised": "Richiesta {PRODOTTO} ricevuta {N} ore fa. Contatta il lead subito.", "note": "Lead recente (ore)"},
  {"category": "RE_ENGAGEMENT", "match": "Contattare urgentemente - richiesta {PRODOTTO} ricevuta {N} giorni fa senza risposta", "revised": "Richiesta {PRODOTTO} rimasta senza risposta da {N} giorni. Contatta il lead con urgenza.", "note": "Lead fermo >10 giorni"},

  {"category": null, "match": "Leva commerciale: {CAMPAGNA}", "revised": "È attiva la campagna {CAMPAGNA}. Usala come leva nella conversazione.", "note": "Leva: campagna attiva (segmento concatenato)"},
  {"category": null, "match": "Punti Viva in scadenza: {N} punti", "revised": "Il cliente ha {N} punti Viva in scadenza. Menzionali durante il contatto.", "note": "Leva: punti Viva in scadenza (segmento concatenato)"},
  {"category": null, "match": "Preventivo/bozza in sospeso — decorrenza tra {NEAR} giorni, salvato {OLD} giorni fa", "revised": "C'è un preventivo salvato. Decorrenza tra {NEAR} giorni, salvato {OLD} giorni fa. Riprendi la conversazione.", "note": "Leva: preventivo in sospeso (entrambe le parti)"},
  {"category": null, "match": "Preventivo/bozza in sospeso", "revised": "C'è un preventivo salvato. Riprendi la conversazione.", "note": "Leva: preventivo in sospeso (senza dettagli)"}
]
```

> Nota di matching: l'ancoraggio `^…$` rende mutuamente esclusivi i pattern con prefisso comune
> (es. RENEWAL ≤30 "… - verificare intenzioni" vs ≤14; QUOTE "… - alto valore" vs standard;
> PAYMENT con/senza "Rischio cancellazione."). L'ordine nell'array non incide sulla correttezza.
> La voce "Preventivo/bozza in sospeso — decorrenza…" va PRIMA di "Preventivo/bozza in sospeso"
> (entrambe `null`): essendo ancorate sono esclusive, ma l'ordine resta quello indicato.

- [ ] **Step 2: Creare `tangible_lab/messages.py` con questo contenuto**

```python
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
```

> Attenzione: nel passo `pattern = _TOKEN_RE.sub(...)` il primo argomento applica la
> sostituzione token→frammento su una stringa in cui i letterali sono GIÀ escapati da
> `_escape_literals`. Poiché `_escape_literals` reinserisce i `{TOKEN}` intatti, la `sub`
> successiva li trasforma nei frammenti regex. Verificare in Step 3 che la regex sia valida.

- [ ] **Step 3: Verifica Python inline (casi rappresentativi + fallback + leve)**

Eseguire:

```bash
cd /Users/luscarpa/Sites/NBA && .venv/bin/python - <<'PY'
from tangible_lab.messages import revise
cases = [
  ("PAYMENT", "Gestire insoluto polizza - scaduto da 50 giorni. Rischio cancellazione.",
   "Polizza con pagamento scaduto da 50 giorni. Rischio cancellazione: contatta il cliente con urgenza."),
  ("PAYMENT", "Gestire insoluto polizza - scaduto da 10 giorni.",
   "Polizza con pagamento scaduto da 10 giorni. Contatta il cliente per regolarizzare."),
  ("RENEWAL", "Rinnovo urgente Auto - scade oggi (€450.0/anno)",
   "Polizza Auto scade oggi (€450.0/anno). Rinnova subito."),
  ("RENEWAL", "Rinnovo Casa in scadenza tra 20 giorni (€300.0/anno) - verificare intenzioni",
   "Polizza Casa in scadenza tra 20 giorni (€300.0/anno). Verifica le intenzioni del cliente."),
  ("CHURN_PREVENTION", "Rischio abbandono - polizza Auto rischio 30%",
   "Cliente a rischio abbandono (30%) sulla polizza Auto. Intervieni per fidelizzare."),
  ("CROSS_SELL", "Proporre polizza Casa - gap di copertura rilevato",
   "Il cliente non ha una copertura Casa. Proponila."),
  ("QUOTE_FOLLOW_UP", "Presentare preventivo Vita €2000.0/anno - alto valore",
   "Preventivo Vita disponibile: €2000.0/anno. Lead ad alto valore — contatta con priorità."),
  ("QUOTE_FOLLOW_UP", "Presentare preventivo Vita €900.0/anno",
   "Preventivo Vita disponibile: €900.0/anno. Contatta il lead per presentarlo."),
  ("FIRST_CONTACT", "Primo contatto - richiesta Auto ricevuta oggi",
   "Richiesta Auto ricevuta oggi. Contatta il lead al più presto."),
  # leva concatenata su CROSS_SELL (split per segmenti)
  ("CROSS_SELL", "Proporre polizza Casa - gap di copertura rilevato — Leva commerciale: Promo Estate — Punti Viva in scadenza: 100 punti",
   "Il cliente non ha una copertura Casa. Proponila. — È attiva la campagna Promo Estate. Usala come leva nella conversazione. — Il cliente ha 100 punti Viva in scadenza. Menzionali durante il contatto."),
  # fallback: testo non mappato resta invariato
  ("PAYMENT", "Testo inventato non mappato", "Testo inventato non mappato"),
]
ok = True
for cat, inp, exp in cases:
    got = revise(cat, inp)
    flag = "OK" if got == exp else "FAIL"
    if got != exp:
        ok = False
        print(flag, cat, "\n  inp:", inp, "\n  got:", got, "\n  exp:", exp)
    else:
        print(flag, cat)
print("TUTTI OK" if ok else "CI SONO FAILURE")
PY
```

Expected: tutte le righe `OK` e l'ultima riga `TUTTI OK`. Se una riga è `FAIL`, correggere `messages.py` o la voce JSON e rieseguire.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/messages_revised.json tangible_lab/messages.py
git commit -m "feat(messaggi): mappatura messaggi rivisti + core Python di rimappatura

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Endpoint mappa + export che segue il toggle (`server.py`)

**Files:**
- Modify: `tangible_lab/server.py` (nuovo endpoint `GET /lab/api/messages-map`; export con parametro `revised`)

**Interfaces:**
- Consumes: `tangible_lab.messages.revise`, `load_map`.
- Produces: `GET /lab/api/messages-map` → JSON (lista mappe). Export Excel: parametro query `revised` (`"1"`/`"0"`).

- [ ] **Step 1: Individuare i punti d'innesto**

Cercare in `server.py`:
- l'endpoint di export Excel in `/lab/admin/*` (cercare `openpyxl` / `Workbook` / `recommended_action` / la funzione che scrive le righe);
- il punto dove viene scritto il testo dell'azione consigliata nella cella (riusa `_nba_for_target` che già estrae `primary.get("recommended_action")`, intorno a riga 514).
- il punto dove montare il nuovo endpoint: **sopra** il mount statico `/lab` (alla fine del file), come gli altri `/lab/api/*`.

Annotare i numeri di riga esatti prima di modificare.

- [ ] **Step 2: Import del modulo messages**

In testa a `server.py`, accanto agli altri import del package `tangible_lab` (es. dove si importano `db`, `auth`, `models`, `checkup_engine`), aggiungere:

```python
from tangible_lab import messages as lab_messages
```

(Se gli altri moduli sono importati con `import db` / `from . import ...`, seguire lo STESSO stile già presente nel file invece di questa riga — vedi gli import esistenti e replicarne la forma.)

- [ ] **Step 3: Endpoint che serve la mappa**

Aggiungere, insieme agli altri `@app.get("/lab/api/...")` (sopra il mount `/lab`):

```python
@app.get("/lab/api/messages-map")
def lab_messages_map():
    """Mappa dei messaggi rivisti per il frontend (toggle 'Messaggi rivisti')."""
    with open(lab_messages.MAP_PATH, encoding="utf-8") as f:
        import json as _json
        return _json.load(f)
```

- [ ] **Step 4: Export che segue il toggle**

Nell'endpoint di export Excel: leggere il parametro query `revised` (default off) e, quando attivo, passare il testo dell'azione attraverso `lab_messages.revise(action_category, recommended_action)` prima di scriverlo in cella.

- Aggiungere il parametro alla firma dell'endpoint, es.: `def export_xlsx(..., revised: str = "0"):` (adattare al nome reale dell'endpoint e al fatto che usi `Request`/`Query`; se usa `Request`, leggere `request.query_params.get("revised")`).
- Dove la cella dell'azione viene popolata con il testo del motore, sostituire il valore con:

```python
_act_text = recommended_action  # testo del motore già estratto
_act_cat = action_category      # action_category dell'azione primaria (estrarla accanto, come si estrae recommended_action)
if str(revised) in ("1", "true", "True"):
    _act_text = lab_messages.revise(_act_cat, _act_text)
# scrivere _act_text nella cella azione
```

> `_nba_for_target` (~488–514) oggi ritorna il testo dell'azione primaria ma forse non la sua
> `action_category`. Se manca, estrarla nello stesso punto in cui si prende
> `primary.get("recommended_action")` (cioè `primary.get("action_category")`) e propagarla fino
> al punto di scrittura della cella. Non cambiare la struttura di ritorno se altri chiamanti la
> usano: aggiungere il campo in coda alla tupla o leggere `action_category` direttamente dove si
> costruisce la riga di export.

- [ ] **Step 5: Verifica**

```bash
cd /Users/luscarpa/Sites/NBA && .venv/bin/python -c "import tangible_lab.server" && echo "import server OK"
```

Riavviare il server (o usare quello di sviluppo già attivo se ricarica i moduli; gli endpoint nuovi richiedono RIAVVIO). Poi:

```bash
curl -s http://127.0.0.1:8000/lab/api/messages-map | head -c 200; echo
```
Expected: inizio di un array JSON con le voci mappa.

(La verifica dell'export con `revised=1` su un caso reale la fa l'utente dopo l'import dataset; qui basta che l'endpoint risponda e che `import server` non sollevi.)

- [ ] **Step 6: Commit**

```bash
git add tangible_lab/server.py
git commit -m "feat(messaggi): endpoint /lab/api/messages-map + export che segue il toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend — toggle, rimappatura JS, applicazione (card + snippet + export) (`studio.js`, `index.html`)

**Files:**
- Modify: `tangible_lab/static/studio.js` (STATE + costante LS; `reviseMessage`; caricamento mappa all'avvio; `renderActionCards`/`renderActionsList`; `buildItems`; toggle in `bindAll`; passaggio `revised` all'export)
- Modify: `tangible_lab/static/index.html` (interruttore "Messaggi rivisti" nell'header)

**Interfaces:**
- Consumes: `GET /lab/api/messages-map`; `STATE.clients[i].nba` (recommended_actions dal bulk); `fetchJSON`.
- Produces: `STATE.revisedMessages` (bool); `STATE.messagesMap` (array compilato); `reviseMessage(category, text) -> str`.

- [ ] **Step 1: STATE + costante + stato toggle**

In `studio.js`, nello STATE (vicino agli altri flag, es. dopo `judgeFilter`), aggiungere:

```js
    revisedMessages: false,   // toggle "Messaggi rivisti"
    messagesMap: null,        // mappa compilata (caricata da /lab/api/messages-map)
```

Accanto alle altre costanti `LS_*` aggiungere:

```js
  const LS_REVISED_MSG = "nba.lab.revisedMessages";
```

- [ ] **Step 2: `reviseMessage` (speculare a messages.py)**

Aggiungere in `studio.js` (vicino agli altri helper di rendering, es. prima di `renderActionCards`):

```js
  // token -> frammento regex (identico a tangible_lab/messages.py)
  const REV_TOKENS = { PRODOTTO:"(.+?)", PREMIO:"([\\d.,]+)", N:"(\\d+)", CAMPAGNA:"(.+?)", NEAR:"(\\d+)", OLD:"(\\d+)" };
  const REV_TOKEN_RE = /\{([A-Z]+)\}/g;
  const REV_SPLIT_CATS = new Set(["CROSS_SELL","VIVA","CHECKUP"]);
  const REV_BLOCK_SEP = " — ";

  function compileMessagesMap(raw) {
    return (raw || []).map(entry => {
      const tokens = [];
      // costruisce il pattern: escape dei letterali, token -> frammento
      let pattern = "", last = 0, m;
      REV_TOKEN_RE.lastIndex = 0;
      while ((m = REV_TOKEN_RE.exec(entry.match)) !== null) {
        pattern += entry.match.slice(last, m.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        pattern += REV_TOKENS[m[1]] || m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        tokens.push(m[1]);
        last = m.index + m[0].length;
      }
      pattern += entry.match.slice(last).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return { category: entry.category, regex: new RegExp("^" + pattern + "$"), tokens, revised: entry.revised };
    });
  }

  function reviseOne(category, text) {
    const map = STATE.messagesMap || [];
    for (const e of map) {
      if (e.category !== null && e.category !== category) continue;
      const mm = e.regex.exec(text);
      if (!mm) continue;
      const values = {};
      e.tokens.forEach((t, i) => { values[t] = mm[i+1]; });
      return e.revised.replace(REV_TOKEN_RE, (_, tk) => (tk in values ? values[tk] : "{"+tk+"}"));
    }
    return text;
  }

  function reviseMessage(category, text) {
    if (!text || !STATE.revisedMessages || !STATE.messagesMap) return text;
    if (REV_SPLIT_CATS.has(category) && text.includes(REV_BLOCK_SEP)) {
      return text.split(REV_BLOCK_SEP).map(seg => reviseOne(category, seg)).join(REV_BLOCK_SEP);
    }
    return reviseOne(category, text);
  }
```

> Nota: `reviseMessage` ritorna il testo invariato se il toggle è OFF o la mappa non è caricata,
> quindi può essere chiamata incondizionatamente nei punti di rendering.

- [ ] **Step 3: Caricare la mappa all'avvio**

Nel punto in cui all'avvio si fanno le fetch iniziali (cercare `fetchJSON("/config")` ~838-840), aggiungere il caricamento della mappa e leggere il toggle da localStorage. Esempio: dopo aver ottenuto le altre risorse, eseguire:

```js
    try {
      const rawMap = await fetchJSON("/lab/api/messages-map");
      STATE.messagesMap = compileMessagesMap(rawMap);
    } catch { STATE.messagesMap = []; }
    STATE.revisedMessages = localStorage.getItem(LS_REVISED_MSG) === "1";
```

(Adattare alla struttura `Promise.all` esistente: si può aggiungere `/lab/api/messages-map` all'array e compilarne il risultato, oppure fare la fetch subito dopo.)

- [ ] **Step 4: Applicare nelle card azione**

In `renderActionCards` (~1258) e `renderActionsList` (~1413), dove si rende `a.recommended_action || ""`, sostituire con:

```js
        el("div", {class:"desc"}, reviseMessage(a.action_category, a.recommended_action) || ""),
```

(Applicare la STESSA modifica in entrambe le funzioni; mantenere il resto della card invariato.)

- [ ] **Step 5: Snippet della lista**

In `buildItems` (~469), per gli item `predef` (client e lead), calcolare lo snippet in base al toggle. Il bulk espone `c.nba` = `recommended_actions`. Sostituire `snippet: summarizeTriggers(det),` con una funzione locale:

```js
        snippet: predefSnippet(det, c.nba),
```

e aggiungere l'helper (vicino a `summarizeTriggers`):

```js
  function predefSnippet(det, nbaActions) {
    if (STATE.revisedMessages && Array.isArray(nbaActions) && nbaActions.length) {
      const primary = nbaActions.find(a => a.primary) || nbaActions[0];
      const t = reviseMessage(primary.action_category, primary.recommended_action);
      if (t) return t;
    }
    return summarizeTriggers(det);
  }
```

> Per i client il bulk popola `c.nba`; per i lead l'item usa `l.nba` (stessa shape, vedi
> `/nba/leads`). Usare il campo `nba` presente sull'oggetto sorgente in entrambi i rami di
> `buildItems`. Per gli item `saved` lo snippet resta `s.notes || "Caso salvato"` (invariato).

- [ ] **Step 6: Toggle nell'header (`index.html`) + wiring (`studio.js`)**

In `index.html`, nell'header del Lab (vicino agli altri controlli globali; cercare l'area azioni dell'header già sistemata nelle fasi precedenti), aggiungere un interruttore:

```html
        <label class="rev-toggle" title="Mostra i messaggi rivisti al posto di quelli del motore">
          <input type="checkbox" id="revised-messages-toggle"/>
          <span class="msi">auto_fix_high</span>
          <span class="rev-toggle-lbl">Messaggi rivisti</span>
        </label>
```

In `studio.js`, in `bindAll`, aggiungere il wiring:

```js
    const revTgl = $("#revised-messages-toggle");
    if (revTgl) {
      revTgl.checked = STATE.revisedMessages;
      revTgl.addEventListener("change", () => {
        STATE.revisedMessages = revTgl.checked;
        localStorage.setItem(LS_REVISED_MSG, revTgl.checked ? "1" : "0");
        STATE.items = buildItems(); updateFolderCounts(); renderListPane();
        if (STATE.selected) runNBA();   // rerender del dettaglio aperto
      });
    }
```

> `runNBA()` ricarica e ri-rende il dettaglio dell'anagrafica selezionata; se non c'è selezione
> basta aver ri-renderizzato la lista. Verificare che `revTgl.checked = STATE.revisedMessages`
> avvenga DOPO che lo stato è stato letto da localStorage (Step 3). Se `bindAll` gira prima del
> caricamento iniziale, impostare anche `revTgl.checked` dopo il load (come per i filtri della
> fase 10): in tal caso allineare la checkbox nel punto del load, oppure spostare la lettura.

- [ ] **Step 7: Passare `revised` all'export**

Cercare in `studio.js` la chiamata che genera/scarica l'export Excel (cercare `export`, l'URL dell'endpoint admin di export). Aggiungere il parametro query secondo lo stato del toggle, es.:

```js
    const exportUrl = `/lab/admin/export?revised=${STATE.revisedMessages ? "1" : "0"}`;
```

(Adattare al nome reale dell'endpoint e al modo in cui l'export viene avviato: se è un `window.open`/link, aggiungere il query param all'URL; se è una `fetch`, aggiungerlo all'URL della fetch.)

- [ ] **Step 8: Verifiche**

```bash
node --check tangible_lab/static/studio.js && echo "node --check OK"
```

Verifica Playwright sul server attivo (http://127.0.0.1:8000/lab/), iniettando una stringa nota per non dipendere da dati reali:
- Caricata la pagina, in console verificare che `STATE.messagesMap` sia un array non vuoto.
- `reviseMessage("RENEWAL", "Rinnovo urgente Auto - scade oggi (€450.0/anno)")` con toggle OFF → torna invariato; con `STATE.revisedMessages=true` → "Polizza Auto scade oggi (€450.0/anno). Rinnova subito." (verificabile via `browser_evaluate` impostando `STATE.revisedMessages`).
- Toggle UI: attivando l'interruttore lo snippet della lista cambia (se ci sono item con azioni) e, aprendo un'anagrafica, la card mostra il testo rivisto; disattivando torna al testo motore / trigger.

(Con dati reali assenti in locale, alcune verifiche si fanno iniettando stringhe; la validazione end-to-end sui clienti reali la fa l'utente dopo l'import.)

- [ ] **Step 9: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/index.html
git commit -m "feat(messaggi): toggle 'Messaggi rivisti' + overlay su card, snippet, export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Fonte dati unica JSON + match su output reale motore → Task 1 (JSON + messages.py). ✅
- Split per segmenti (CROSS_SELL/VIVA/CHECKUP) + reconciliazione categorie (FIRST_CONTACT, leve category:null) → Task 1 (dati + `revise`). ✅
- Endpoint mappa + export che segue il toggle → Task 2. ✅
- Toggle UI + applicazione su card/snippet + load mappa + export param → Task 3. ✅
- Fallback sicuro (testo invariato) → `_revise_one`/`reviseOne` ritornano `text` se nessun match. ✅

**Placeholder scan:** nessun TBD; il JSON è completo (47 voci); codice Python e JS completi. I punti "adattare al nome reale dell'endpoint" in Task 2/3 sono istruzioni di localizzazione su codice esistente non incluso nel piano, non placeholder di logica nuova. ✅

**Type/contract consistency:** token set identico in JSON, `messages.py` (`_TOKENS`) e `studio.js` (`REV_TOKENS`): PRODOTTO/PREMIO/N/CAMPAGNA/NEAR/OLD. Separatore `—` con spazi identico. `_SPLIT_CATEGORIES`==`REV_SPLIT_CATS`. `revise`(py) e `reviseMessage`(js) stessa semantica (toggle-aware solo lato JS; py sempre attivo perché chiamato solo quando `revised=1`). ✅

**Rischio noto:** la logica di compilazione regex è duplicata in due linguaggi; lo Step 3 (Python) e lo Step 8 (JS, via Playwright) verificano gli stessi casi per tenerle allineate.
