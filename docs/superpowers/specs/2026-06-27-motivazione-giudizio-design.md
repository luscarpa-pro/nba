# Design — Motivazione del giudizio operatore

Data: 2026-06-27

## Contesto e problema

Oggi il giudizio operatore è solo `ok | ko | unsure`, senza motivazione. Le "Note" (thread
commenti) sono separate e a uso interno. Si vuole: quando si marca **Sbagliato (ko)** o
**Da verificare (unsure)**, chiedere **subito una motivazione** scegliendola da una lista
(set diverso per ko e unsure) + possibilità di **"Altro"** con testo libero. La motivazione è
**obbligatoria**. Le Note restano promemoria interni. Nell'**export** deve comparire la
**motivazione del giudizio** (non le note); le Note vanno in un foglio separato secondario.

## Decisioni (dal brainstorming)

- Motivazione **obbligatoria** per ko/unsure (per "Corretto/ok" nessuna motivazione).
- **Set diversi** per ko e unsure (sotto).
- Export: motivazione nei fogli principali ("Stato per anagrafica" e "Giudizi");
  foglio "Note" mantenuto come **secondario** (resta l'ultimo foglio).
- Liste motivazioni **fisse nel codice** (non editabili da UI). Nessuna analitica per
  motivazione (solo raccolta + export).

### Set "Sbagliato" (ko)
1. Priorità errata
2. Azione non pertinente
3. Canale sbagliato
4. Tempistica sbagliata
5. Dato o trigger errato
6. Altro → testo libero (obbligatorio)

### Set "Da verificare" (unsure)
1. Dato di base dubbio/incompleto
2. Caso limite / situazione ambigua
3. Manca contesto sul cliente
4. Plausibile, ma da confermare
5. Sospetto errore, da approfondire
6. Altro → testo libero (obbligatorio)

## Architettura

### 1. Dati (`db.py`)
Tabella `reviews`: due nuove colonne **`reason TEXT`** e **`reason_text TEXT`** (entrambe
nullable). Si conserva la **label** scelta (es. "Azione non pertinente") in `reason`; per
"Altro", `reason = "Altro"` e `reason_text` = testo libero.
- `CREATE TABLE reviews` aggiornato con le due colonne (per DB nuovi).
- **Migrazione additiva** in `init_db()`: per i DB esistenti, `ALTER TABLE reviews ADD COLUMN`
  delle due colonne se non presenti (controllo via `PRAGMA table_info(reviews)`). Un piccolo
  helper `_ensure_columns(conn, table, {col: decl})` idempotente.

### 2. Persistenza (`models.py`)
- `upsert_review(user_id, target_key, judgement, reason=None, reason_text=None)`:
  - per `judgement == "ok"` → forza `reason=NULL, reason_text=NULL` (nessuna motivazione);
  - per ko/unsure → salva `reason` e `reason_text`.
  - sia su INSERT sia su UPDATE.
- Le query di lettura espongono i nuovi campi: `get_user_review`, `list_reviews_for_target`,
  `list_all_user_reviews`, `list_all_reviews_export` → aggiungono `reason`, `reason_text`.

### 3. API (`server.py`)
`PUT /lab/api/reviews/{target_key}` — il body accetta `reason`, `reason_text` oltre a
`judgement`. **Validazione**:
- `judgement` in `ok|ko|unsure` (invariato);
- se `judgement` in (`ko`,`unsure`): `reason` **obbligatorio** (stringa non vuota); se
  `reason` vale "Altro" (case-insensitive) allora `reason_text` obbligatorio → altrimenti
  `400`;
- se `judgement == "ok"`: `reason`/`reason_text` ignorati (passati come None).
Passa i valori a `models.upsert_review`.

### 4. Export Excel (`server.py`)
- **Sheet "Stato per anagrafica"**: nuova colonna **"motivazione"** (la motivazione della
  review per quel target; in single-user è una sola). Per "Altro" si mostra
  `Altro — <reason_text>`.
- **Sheet "Giudizi"**: due nuove colonne **"motivazione"** e **"dettaglio"** (reason_text).
- **Sheet "Note"**: invariato nei contenuti, resta l'**ultimo** foglio (secondario).
- Per la per-anagrafica, la motivazione si recupera per `target_key` (mappa target→reason
  costruita una volta da una query, accanto a `target_stats`).

### 5. UI (`studio.js` + `studio.css`)
- Costanti: `REVIEW_REASONS = { ko: [...], unsure: [...] }` (le liste sopra; l'ultima voce è
  "Altro").
- `buildReviewBar`:
  - click **"Corretto"** → `setReview(it, "ok")` immediato (come ora), reason azzerata.
  - click **"Sbagliato"/"Da verificare"** (non attivo) → apre un **popover motivazione**
    ancorato alla barra: titolo, radio con il set corretto, "Altro" mostra un `input` testo;
    bottone **"Conferma"** disabilitato finché non c'è una motivazione valida (e testo per
    "Altro"); bottone **"Annulla"**; link **"Rimuovi giudizio"**.
  - click su un giudizio **già attivo** ko/unsure → riapre il popover **pre-compilato** (per
    modificare la motivazione); la rimozione avviene dal link nel popover (non più col
    semplice toggle, per non perdere la motivazione per sbaglio). Per "ok" attivo: toggle via
    rimozione come ora.
  - Mostra la motivazione scelta come **chip** accanto al giudizio (es. "motivo: Azione non
    pertinente"); il chip è cliccabile e riapre il popover.
- `setReview(it, judgement, reason=null, reason_text=null)` → invia anche `reason`/`reason_text`
  nel PUT; aggiorna `STATE.reviews[key]` con `{judgement, reason, reason_text, reviewedAt}`.
- `STATE.reviews[...]` ora include `reason`/`reason_text` (popolati da `loadReviewsFromAPI`).
- CSS: riuso dello stile popover dei filtri (`.filter-popover`) o nuovo `.reason-popover`
  coerente; chip `.review-reason-chip`.

## Data flow

Click ko/unsure → popover → scelta motivazione (+ testo se Altro) → "Conferma" →
`setReview(it, judgement, reason, reason_text)` → PUT → DB. La barra mostra giudizio + chip
motivazione. L'export legge `reason`/`reason_text` dal DB.

## Non-obiettivi (YAGNI)
- Niente editor UI delle liste motivazioni; niente analitica/aggregazione per motivazione.
- Niente motivazione per "Corretto".
- Le Note (commenti) restano invariate come funzione separata.

## Testing
- **Python**: migrazione idempotente (ALTER non rieseguito se colonne presenti); `upsert_review`
  salva reason per ko/unsure e la azzera per ok; export query restituiscono i nuovi campi.
- **API**: PUT senza reason su ko → 400; con reason → 200; "Altro" senza testo → 400;
  ok ignora reason.
- **UI (Playwright)**: click "Sbagliato" → popover con set ko; "Altro" mostra il testo;
  "Conferma" disabilitato finché non valido; salvataggio mostra il chip; ricaricando la pagina
  la motivazione persiste; "Corretto" non apre popover.
- **Export**: con un giudizio ko motivato, i fogli "Stato per anagrafica" e "Giudizi" mostrano
  la motivazione; "Note" resta in fondo.
- `node --check tangible_lab/static/studio.js`; `python -c "import tangible_lab.server"`.

## Rischi
- Migrazione su DB esistenti: se l'`ALTER` fallisse, le colonne mancanti darebbero errori in
  lettura. Mitigazione: helper idempotente + verifica `PRAGMA table_info`.
- Cambio di comportamento del click sul giudizio attivo (non più toggle immediato per ko/unsure):
  va comunicato; la rimozione resta possibile dal popover.
