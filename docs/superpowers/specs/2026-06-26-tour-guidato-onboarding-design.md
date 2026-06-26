# Design — Tour guidato di onboarding + import in primo piano

Data: 2026-06-26

## Contesto e problema

Il tutorial attuale è un overlay con una lista di 5 punti testuali: spiega poco il progetto e
non mostra DOVE sono le cose. Si vuole un **tour guidato** che evidenzia le aree reali della UI
(spotlight + fumetto), potenziando la comprensione del progetto. Inoltre, sulla pagina "Dati"
il blocco di **importazione dataset** deve essere il primo e più evidente (è il punto di
ingresso dell'onboarding).

## Decisioni (dal brainstorming)

- Tour a tappe con **spotlight** sull'area + **callout** (titolo+testo) e navigazione
  Avanti/Indietro/Salta + pallini di avanzamento.
- **Parte in automatico al primo avvio** (flag `localStorage` `nba.lab.tutorial.seen`), e da
  "Dati → Rivedi tutorial" (`/lab/?tutorial=1`).
- **Senza dataset**: il tour mostra una schermata che invita a caricare i dati con CTA che porta
  alla pagina Dati (`/lab/admin.html?onboarding=1`). Dopo l'import si torna automaticamente al
  Lab e — dati ora presenti, tutorial non ancora visto — parte il **tour completo**.
- **Con dataset**: tour completo; il tour **apre un'anagrafica d'esempio** (la prima della lista)
  per poter evidenziare le aree del dettaglio (tab NBA/Profilo) e la barra giudizio.

## Componenti

### 1. Motore tour (`studio.js`)

`startTour(steps)` / `tourGoTo(i)` / `endTour(markSeen)`. Stato locale `TOUR = {steps, i}`.
Ogni step: `{ target: <selector|null>, title, body, cta?: {label, href} }`.
- `target=null` → card centrale (intro / schermata "carica dati").
- `target` valorizzato → **spotlight**: un riquadro `position:fixed` sul bounding rect del
  target (con padding e bordo arrotondato) e `box-shadow: 0 0 0 9999px rgba(15,17,32,.55)` per
  oscurare il resto; **callout** `position:fixed` ancorato sotto/sopra il target (in base allo
  spazio), clampato nel viewport; frecce/pallini + bottoni.
- Riposizionamento su `resize` e su cambio step. Backdrop cattura i click (blocca l'interazione
  con la UI sottostante); solo i bottoni del callout sono attivi. `Esc` = Salta.
- Se un `target` non esiste al momento, lo step ripiega sul contenitore più vicino disponibile
  (es. `.ml-detail-pane`) o viene saltato senza errori.

### 2. Tappe del tour completo

1. Intro (no target) — cos'è NBA Studio: *il motore NBA di Vittoria assegna a ogni cliente/lead
   una priorità e l'azione migliore; in Tangible Lab le testiamo e validiamo*.
2. `aside.ml-sidebar` — cartelle: filtra per tier (CRITICAL→LOW) e tipo (clienti/lead).
3. `.ml-search-row` — ricerca + Filtri per giudizio operatore.
4. `.ml-side-actions` — toggle "Messaggi rivisti" e "Nuova anagrafica".
5. `section.ml-list-pane` — lista: priorità, punteggio, badge giudizio.
6. `.detail-tabs` — tab NBA / Profilo (Perché/trigger, azioni+canale, breakdown).
7. `.review-bar` — giudizio operatore (Corretto/Sbagliato/Da verificare) + Note.
8. `header.studio .actions` — Dati / Check-up / Guida / Pesature.

### 3. Flusso senza dataset

Una sola schermata (no target): titolo "Carica i dati per iniziare" + spiegazione + CTA
**"Vai a importare i dati"** → `/lab/admin.html?onboarding=1`. Bottone secondario "Salta"
(marca `seen`). Non marca `seen` se si va a importare (così al rientro parte il tour completo).

### 4. Integrazione init (`studio.js`)

Spostare la decisione tutorial **dopo** il caricamento di clienti/lead (oggi `showTutorial()`
gira prima). Nuova `maybeStartTour()` chiamata dopo `renderListPane()`:
- `forced = (?tutorial=1)`; `seen = localStorage`. Se `!forced && seen` → niente.
- Pulisce l'URL se forced.
- `hasData = STATE.items` contiene predef (clienti/lead).
- `hasData` → `startTour(FULL_STEPS)` dopo aver aperto la prima anagrafica
  (`loadAnagrafica(firstPredef)`), così tab e barra giudizio esistono.
- `!hasData` → `startTour([IMPORT_STEP])`.

### 5. Import in primo piano sulla pagina Dati (`admin.js`)

In `renderExport()` riordinare: **"Importa dataset" come primo blocco**, reso prominente
(card con `primary-cta` sul bottone Importa, intestazione chiara). Seguono Esporta, Check-up,
Altro. Se `?onboarding=1`: evidenziare la card import (classe `.onboarding-focus`) e, dopo un
import riuscito, **redirect a `/lab/`** (che farà partire il tour completo). Senza
`onboarding=1` nessun redirect (re-import normale resta sulla pagina).

## Non-obiettivi (YAGNI)

- Niente tour per la pagina Check-up/Guida/Dati (solo la schermata principale del Lab).
- Niente persistenza della posizione/step raggiunto; il tour riparte dall'inizio.
- Niente evidenziazione animata oltre allo spotlight (no frecce animate complesse).

## Testing

- Playwright (dati presenti): `/lab/?tutorial=1` avvia il tour; verificare che lo spotlight
  inquadri i target attesi (sidebar, search-row, side-actions, list-pane, detail-tabs,
  review-bar, header actions), che Avanti/Indietro/pallini funzionino, che alla fine `seen` sia
  impostato e l'overlay sparisca; che la prima anagrafica sia stata aperta (detail-tabs presenti).
- Schermata "no data": forzare il ramo (svuotando temporaneamente `STATE.items` via hook di
  test) e verificare CTA verso `/lab/admin.html?onboarding=1`.
- Dati: il primo blocco è "Importa dataset" con CTA primaria; con `?onboarding=1` la card è
  evidenziata.
- `node --check tangible_lab/static/studio.js`.

## Rischi

- Target del dettaglio non ancora renderizzati quando il tour vi arriva (apertura anagrafica
  async): mitigato aprendo l'anagrafica all'avvio del tour e con fallback al pannello dettaglio.
- `box-shadow` spotlight su elementi dentro contenitori con `overflow:hidden`: lo spotlight è
  `position:fixed` a livello body, quindi non è clippato dai pannelli.
