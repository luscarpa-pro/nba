# Design — Messaggi rivisti (overlay mappatura azioni NBA)

Data: 2026-06-26
Fonte mappatura: `NBA_Messaggi_Azioni.xlsx`, foglio **"NBA Messaggi aggiornati"** (47 righe).

## Contesto e problema

Il motore NBA (read-only, del cliente) produce per ogni azione un testo `recommended_action`
sintetico/operativo (es. `Rinnovo urgente Auto - scade oggi (€450.0/anno)`). Il cliente ha
fornito una riscrittura più discorsiva di ognuno (es. `Polizza Auto scade oggi (€450/anno).
Rinnova subito.`). Vogliamo poter vedere nel Lab i **messaggi rivisti** al posto di quelli del
motore, **senza toccare il motore** (overlay nel solo strato Lab).

## Vincoli

- Solo file del Lab: `tangible_lab/**` e `tangible_lab/static/**`. MAI file vendored
  (`nba_engine.py`, `nba_api.py`, `static/` in root, `dataset.json`, ...).
- Lingua italiana per copy e commenti.
- Nessuna dipendenza da modifiche al motore: la mappatura è un overlay; se un messaggio del
  motore non combacia, si mostra **invariato** (fallback sicuro, mai vuoto).
- Niente test runner: `node --check` + verifica Playwright; per il Python una verifica
  inline con `.venv/bin/python` su casi noti.

## Decisioni (dal brainstorming)

1. **Toggle globale "Messaggi rivisti"** nell'header; stato in `localStorage`
   (`nba.lab.revisedMessages`). Off di default.
2. Si applica a: **card azione del dettaglio**, **snippet della lista**, **export Excel**.
3. **Lista**: con toggle ON lo snippet mostra il **messaggio rivisto dell'azione primaria**;
   con toggle OFF resta sui trigger (`summarizeTriggers`).
4. **Export Excel**: **segue il toggle** — una sola colonna azione, testo motore o rivisto a
   seconda dello stato del toggle al momento dell'export (passato come parametro all'endpoint).
5. La **chiave di matching** è il pattern dell'**output reale del motore** (autorato da
   `nba_engine.py`), NON la colonna "Messaggio generato dal motore" dell'Excel (che ha derive
   di trascrizione: `euro` vs `€`, `-` vs `—`, ecc.). L'Excel fornisce solo il testo rivisto.

## Architettura

### 1. Fonte dati unica — `tangible_lab/messages_revised.json`

Una lista di voci; ogni voce mappa un pattern di output del motore al suo testo rivisto:

```json
[
  {
    "category": "RENEWAL",
    "match": "Rinnovo urgente {PRODOTTO} - scade oggi (€{PREMIO}/anno)",
    "revised": "Polizza {PRODOTTO} scade oggi (€{PREMIO}/anno). Rinnova subito.",
    "note": "Scadenza oggi"
  }
]
```

- `category` = `action_category` dell'azione (filtro grossolano per ridurre i match).
- `match` = **template** che riproduce l'output del motore, con segnaposto `{NOME}` nei punti
  variabili. NON è una regex grezza: è language-agnostic (vedi §2).
- `revised` = template del testo rivisto, con gli **stessi** segnaposto di `match`.
- `note` = la "Situazione" dall'Excel (solo documentazione).

Segnaposto ammessi e relativo frammento regex (condiviso fra Python e JS):

| Token          | Significato                    | Frammento regex |
|----------------|--------------------------------|-----------------|
| `{PRODOTTO}`   | nome prodotto/polizza          | `(.+?)`         |
| `{PREMIO}`     | premio (float/int)             | `([\d.,]+)`     |
| `{N}`          | numero intero (giorni/ore/%/punti) | `(\d+)`     |
| `{CAMPAGNA}`   | nome campagna                  | `(.+?)`         |
| `{NEAR}`       | giorni a decorrenza            | `(\d+)`         |
| `{OLD}`        | giorni dal salvataggio         | `(\d+)`         |

I segnaposto sono "non greedy" dove serve; l'ancoraggio è `^…$` sull'intera stringa.
Nota tecnica: per `RELATIONSHIP`/`CHURN_PREVENTION` i testi del motore usano il trattino lungo
`—` (U+2014); i `match` devono riprodurlo fedelmente.

### 2. Logica di rimappatura (speculare JS + Python)

Funzione `revise(category, engineText)` → `revisedText | engineText`:
1. **Split per segmenti (solo `CROSS_SELL`, `VIVA`, `CHECKUP`)**: per queste categorie il motore
   concatena le "leve" al messaggio base con il separatore ` — ` (spazio, em-dash U+2014, spazio)
   — vedi `nba_engine.py` (`base + " — " + " — ".join(blocks)`). Si **spezza** `engineText` su
   ` — `, si rimappa **ogni segmento** indipendentemente (passo 2–5) e si **ricongiunge** con
   ` — `. I messaggi base di queste categorie usano il trattino corto ` - ` (non em-dash), quindi
   lo split è sicuro. Per **tutte le altre categorie** (incl. `RELATIONSHIP`, che usa ` — ` dentro
   un messaggio unico) si rimappa l'intera stringa senza split.
2. Filtra le voci con `category` uguale (più eventuali voci `category: null` come fallback).
3. Per ciascuna voce, **compila** `match` in regex: escape dei caratteri speciali nelle parti
   letterali, sostituzione di ogni `{TOKEN}` col suo frammento regex (in ordine di apparizione),
   ancoraggio `^…$` (l'ancoraggio è ciò che distingue varianti con prefisso comune, es.
   QUOTE_FOLLOW_UP "alto valore" vs standard, o PAYMENT ≥45 vs <45).
4. Se la regex combacia, cattura i gruppi in ordine e li associa ai token di `match` nell'ordine
   in cui compaiono (mappa token→valore).
5. Rende `revised` sostituendo ogni `{TOKEN}` col valore della mappa (un token può comparire più
   volte / in ordine diverso nel `revised`).
6. Primo match vince. Nessun match (sull'intera stringa o sul singolo segmento) → quel testo
   resta invariato.

**Reconciliazione nomi categoria**: l'`action_category` del motore è la chiave autorevole. Alcune
etichette dell'Excel differiscono: Excel `NEW_CONTACT` → motore **`FIRST_CONTACT`**; le righe
"leva" dell'Excel (`CROSS_SELL - Leva`) si mappano comunque sotto `category: "CROSS_SELL"` perché
i blocchi vengono concatenati ad azioni CROSS_SELL/VIVA/CHECKUP.

Implementazioni:
- **Python**: `tangible_lab/messages.py` — `load_map()` (legge il JSON, cache),
  `revise(category, text) -> str`. Compilazione regex con `re`, named o posizionali.
- **JS**: in `studio.js` — carica il JSON via endpoint (`GET /lab/api/messages-map`),
  funzione `reviseMessage(category, text)` con la stessa logica (RegExp).
- La **tabella token→frammento** è piccola e duplicata nei due linguaggi (come `CLIENT_SCHEMA`).
  I **dati** (47 mappe) stanno una sola volta nel JSON.

### 3. Endpoint per servire la mappa al frontend

In `server.py`, sopra il mount statico `/lab`: `GET /lab/api/messages-map` ritorna il
contenuto di `messages_revised.json`. (Single-user: nessun requisito di auth particolare oltre
a quelli già presenti.) Il frontend la carica una volta all'avvio (insieme a `/config`).

### 4. Toggle UI

- Interruttore "Messaggi rivisti" nell'header del Lab (vicino agli altri controlli globali).
- Stato in `STATE.revisedMessages` (bool) + `localStorage` `nba.lab.revisedMessages`.
- Al cambio: ri-render della lista e del dettaglio aperto.

### 5. Punti di applicazione nel frontend (`studio.js`)

- **Card azione**: `renderActionCards` (~1258) e `renderActionsList` (~1413) — il testo mostrato
  diventa `STATE.revisedMessages ? reviseMessage(a.action_category, a.recommended_action) :
  a.recommended_action`.
- **Snippet lista**: `buildItems` (~469) — il bulk `/nba/clients|leads` espone già
  `nba` = `recommended_actions` per item (in `STATE.clients[i].nba`). Con toggle ON, lo snippet
  diventa il `reviseMessage(...)` dell'azione `primary` (fallback alla prima azione); con toggle
  OFF resta `summarizeTriggers(det)`. Per i `saved` resta invariato (`s.notes`).

### 6. Export Excel (`server.py`)

- L'endpoint di export (in `/lab/admin/*`) accetta un parametro **`revised`** (es. `?revised=1`)
  passato dal frontend secondo lo stato del toggle.
- Quando `revised` è attivo, la cella della colonna azione usa
  `messages.revise(action_category, recommended_action)`; altrimenti il testo del motore.
- L'intestazione/colonna resta una sola ("Azione consigliata"); cambia solo il contenuto.

## Inventario mappe (categorie coperte, dal foglio + da `nba_engine.py`)

CLIENT: `PAYMENT` (≥45 / <45), `RENEWAL` (oggi / ≤7 / ≤14 / ≤30 / ≤45), `CHURN_PREVENTION`
(high / single / fallback), `CROSS_SELL` (11 gap + upsell legacy + fallback), `CROSS_SELL` leve
concatenabili (campagna / punti Viva / preventivo), `VIVA` (expiring / high / non iscritto),
`CHECKUP`, `RELATIONSHIP` (baseline / sinistro+reclamo / sinistro / reclamo / no-contatto /
compleanno oggi / compleanno imminente / anniversario / default).
LEAD: `LEAD_CONVERSION`, `QUOTE_FOLLOW_UP` (alto valore / standard), `NEW_CONTACT`/`FIRST_CONTACT`
(oggi / ieri / ore), `RE_ENGAGEMENT`.

Per ogni voce, `match` va autorato leggendo la f-string esatta in `nba_engine.py` (funzioni
`_cosa_*`, `_growth_rationale_blocks`, `lead_actions`), `revised` dalla colonna "Messaggio
rivisto" dell'Excel.

## Non-obiettivi (YAGNI)

- Nessuna modifica al motore o ai testi alla fonte.
- Nessun editor UI della mappatura (il JSON si aggiorna a mano / da script).
- Le "leve concatenabili" (campagna / punti Viva / preventivo) non sono blocchi separati nell'UI:
  sono gestite dallo split per segmenti (vedi §2) — ogni leva concatenata dal motore viene
  rimappata nel proprio testo rivisto e ricongiunta. Nessun controllo UI dedicato alle leve.
- Nessun supporto al primo foglio "Messaggi NBA" (39 righe, versione precedente).

## Testing

- **Python** (`messages.revise`): per ~8 casi rappresentativi (uno per categoria con variabili:
  PAYMENT≥45, RENEWAL oggi, RENEWAL ≤7, CHURN high, CROSS_SELL Casa, VIVA expiring,
  QUOTE_FOLLOW_UP alto valore, RE_ENGAGEMENT) verificare che l'output combaci col `revised`
  atteso con i valori sostituiti; e che un testo non mappato torni invariato.
- **JS** (`reviseMessage`): stessi casi verificati via Playwright iniettando stringhe note.
- **Toggle/UI** (Playwright): toggle ON → la card del dettaglio mostra il testo rivisto;
  lo snippet della lista cambia da trigger a messaggio rivisto primario; toggle OFF → torna come
  prima. `node --check studio.js`.
- **Export**: chiamata all'endpoint con e senza `revised` → la cella azione contiene
  rispettivamente il testo rivisto e quello del motore (verifica su un caso noto).

## Rischi

- **Drift del motore**: se il cliente aggiorna `nba_engine.py` e cambia un testo, il `match`
  relativo non combacia più → fallback al testo motore (degradazione innocua, non un crash).
  Da ricontrollare ad ogni aggiornamento del motore (annotato come gli altri "coupling points").
- **Formattazione premio**: il motore emette il premio come float (`450.0`); il `{PREMIO}`
  cattura `[\d.,]+` e lo ripropone identico nel rivisto (nessuna normalizzazione, per non
  introdurre differenze). Se in futuro si vuole `450` invece di `450.0`, è un'aggiunta separata.
- **Ordine dei gap CROSS_SELL**: il motore sceglie il gap "primo in lista"; il `match` cattura
  il nome prodotto via `{PRODOTTO}`, quindi è indipendente da quale gap sia.
