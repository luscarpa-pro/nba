# Design — Fase 10: Modalità, filtri giudizio, responsive

Data: 2026-06-26

## Contesto e problema

Tre interventi sulla UI del Lab (`tangible_lab/static/`):

1. La card "Riepilogo priorità" mostra una tile "Modalità" (`presentation_mode`) che
   non serve in quella vista.
2. L'area di ricerca permette solo testo libero + un toggle "Nascondi analizzati".
   L'operatore non può filtrare la lista per il proprio giudizio (Corretto / Sbagliato /
   Da verificare / Non ancora giudicati).
3. Il responsive è trascurato nella fascia **tablet / finestra stretta (~700–1000px)**:
   `.detail-tabs` sfora di pochi px, le barre di "Composizione del punteggio" vengono
   clippate, la toolbar di ricerca si stringe male.

## Obiettivi

1. Rimuovere la tile **"Modalità"** dalla card "Riepilogo priorità".
2. Aggiungere **filtri avanzati per giudizio operatore** in un pannello a comparsa
   accanto alla ricerca, assorbendo l'attuale toggle "Nascondi analizzati".
3. Curare il **responsive** nella fascia ~700–1000px.

## Vincoli

- Solo `tangible_lab/static/studio.js` e `studio.css`. Nessun backend, nessun file vendored.
- Lingua italiana per ogni copy/commento. Riuso degli helper esistenti.
- Niente framework di test: `node --check tangible_lab/static/studio.js` + verifica Playwright.
- Stato dei filtri persistito in `localStorage` sotto chiavi `nba.lab.*` (come l'attuale
  `nba.lab.hideReviewed`).

## Componenti

### 1. Rimozione tile "Modalità" dal Riepilogo priorità

In `studio.js`, nella costruzione delle tile del "Riepilogo priorità" (intorno a riga 1038),
rimuovere la chiamata `statTile("Modalità", presLabel, "view_compact")` e, se non più usata
altrove, la variabile `presLabel` (riga ~1013, `out.presentation_mode || "—"`). Le altre tile
restano invariate.

**Fuori da questo componente:** la meta "Modalità: …" nell'header del dettaglio (riga ~927)
**resta invariata** (decisione utente).

### 2. Filtri avanzati per giudizio operatore

**Stato (STATE + localStorage).**
- Sostituire il booleano `hideReviewed` con un set di giudizi visibili. Modello:
  `STATE.judgeFilter = { ok: true, ko: true, unsure: true, none: true }` dove le chiavi sono
  i tre `judgement` del motore review (`ok` = Corretto, `ko` = Sbagliato, `unsure` = Da
  verificare) più `none` = non ancora giudicati. Default: tutte `true` (mostra tutto).
- Persistenza in `localStorage` sotto una nuova chiave `nba.lab.judgeFilter` (JSON).
  Migrazione soft: se esiste la vecchia chiave `nba.lab.hideReviewed === "1"`, all'avvio
  impostare `{ok:false, ko:false, unsure:false, none:true}` (equivalente a "solo non
  analizzati") e poi ignorare la vecchia chiave.

**UI.**
- Accanto all'input di ricerca (nella `.ml-list-toolbar`) un pulsante **"Filtri"** (icona
  `tune`/`filter_list`) con un **badge** numerico = quanti giudizi sono *esclusi*
  (cioè `4 - n_attivi`); badge nascosto quando tutti e 4 sono attivi (nessun filtro).
- Al click il pulsante apre/chiude un **pannello a comparsa** (popover ancorato sotto il
  pulsante) con 4 checkbox: **Corretto / Sbagliato / Da verificare / Non ancora giudicati**,
  e in fondo un link/bottone **"Azzera filtri"** che riporta tutte e 4 a `true`.
- Il popover si chiude su click esterno e su `Esc`. Riuso dello stile popover esistente se
  presente; altrimenti un `.filter-popover` minimale in `studio.css`.
- **Rimozione del toggle "Nascondi analizzati"** dalla toolbar (assorbito dal pannello).

**Filtraggio.**
- In `renderListPane`, dopo `items = applyQuery(items, STATE.query)`, sostituire l'attuale
  riga `if (STATE.hideReviewed) …` con un filtro basato su `STATE.judgeFilter`:
  per ogni item, ricavare la chiave di giudizio (`getReview(it)?.judgement` oppure `none`)
  e tenerlo solo se `STATE.judgeFilter[key]` è `true`.

### 3. Responsive (~700–1000px)

Solo `studio.css` ove possibile.
- **`.detail-tabs`**: correggere lo sforamento (box-sizing/padding/gap) così le tab restano
  nella larghezza del pannello senza overflow.
- **Composizione del punteggio** (le barre `span.s`): il contenitore deve adattarsi alla
  larghezza disponibile (larghezza fluida / wrap) invece di clippare il contenuto.
- **`.ml-list-toolbar`**: ricerca + "Filtri" (+ eventuali altri controlli) devono andare a
  capo in modo pulito quando lo spazio si stringe, senza schiacciare l'input di ricerca.
- Verificare il passaggio già esistente a layout compatto a 1000px (`.ml-layout` → `1fr`,
  bottone "indietro") e rifinire ciò che stona in quel range. Niente nuovi breakpoint se
  non necessari.

## Data flow

Ricerca/filtri → `STATE.query` + `STATE.judgeFilter` → `renderListPane` filtra gli item →
lista aggiornata. Toggle di una checkbox nel popover → aggiorna `STATE.judgeFilter`,
persiste in `localStorage`, aggiorna badge, richiama `renderListPane`.

## Non-obiettivi (YAGNI)

- Nessun filtro per priorità, tipo record o canale/azione (scelto: solo giudizio).
- Nessuna ottimizzazione responsive spinta sotto i 420px (telefono verticale stretto).
- La meta "Modalità" nell'header del dettaglio resta.

## Testing

- `node --check tangible_lab/static/studio.js`.
- Playwright:
  - Riepilogo priorità: la tile "Modalità" non è più presente; le altre sì.
  - Filtri: pulsante "Filtri" apre il pannello; deselezionando "Corretto" gli item Corretti
    spariscono dalla lista; "Azzera filtri" li riporta; badge coerente col numero di giudizi
    esclusi; stato persiste dopo reload.
  - "Nascondi analizzati" non è più nella toolbar.
  - Responsive a ~768px e ~960px: nessun overflow orizzontale, tab del dettaglio dentro la
    riga, barre punteggio non tagliate, toolbar che va a capo in modo leggibile.

## Rischi

- Migrazione `hideReviewed` → `judgeFilter`: se la migrazione non scatta, l'utente riparte
  con tutti i giudizi visibili (degradazione innocua, non un crash).
- Individuare il contenitore delle barre punteggio per il fix responsive: se la struttura
  cambia lato motore, il fix CSS potrebbe non agganciarsi (degradazione innocua).
