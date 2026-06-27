# Design — Modalità esercizio (ipotizza la criticità, poi rivela)

Data: 2026-06-27

## Contesto e problema
Per allenare chi testa, serve una modalità che **nasconde criticità e NBA** mostrando solo
clienti/lead e i loro **profili**. Il tester ipotizza la criticità osservando il profilo, poi
la **rivela** e confronta la propria ipotesi con quella del motore. Toggle nella sidebar,
**sopra** "Messaggi rivisti".

## Decisioni (dal brainstorming)
- **Ipotesi + confronto** effimero (non salvato): prima di rivelare, il tester sceglie
  Critica/Alta/Media/Bassa; alla rivelazione vede "ipotesi vs reale" con ✓/✗.
- **Rivelazione per anagrafica**: aperto un record si vede solo il Profilo + ipotesi + "Rivela";
  cambiando record torna nascosto.
- **Nascondere anche le cartelle "Per priorità"** (oltre a colore tier e punteggio nelle righe).
- Solo frontend. I dati NBA restano nel DOM ma nascosti (accettabile per training interno).

## Componenti

### 1. Stato + toggle
- `STATE.exerciseMode` (bool) ← `localStorage` `nba.lab.exerciseMode`.
- `STATE.revealed = {}` (reviewKey → true) e `STATE.hypotheses = {}` (reviewKey → tier): effimeri,
  azzerati allo spegnimento della modalità.
- `index.html`: in `.ml-side-actions`, **prima** della label "Messaggi rivisti", una label
  `.rev-toggle` con `<input id="exercise-toggle">`, icona `psychology`, testo "Modalità esercizio".
- Wiring (`bindAll`): al change → aggiorna stato + localStorage; `html.classList.toggle("exercise-mode", on)`;
  se attiva e la cartella corrente è `tier:*` → riporta `STATE.folder="all"` (+ `updateFolderActive`);
  azzera `revealed`/`hypotheses`; `renderListPane()`; se c'è un'anagrafica aperta, ricarica il dettaglio
  (`loadAnagrafica(STATE.selected)` o re-render).
- `init`: legge il flag, applica la classe `exercise-mode` su `<html>`, allinea la checkbox dopo il load.

### 2. Lista, cartelle, ordinamento (`studio.js` + `studio.css` + `index.html`)
- **Ordinamento neutro**: in `renderListPane`, se `exerciseMode`, ordina per `id`
  (`localeCompare`) invece di `sortItems` (che ordina per punteggio → rivelerebbe).
- **Cartelle**: in `index.html` marcare la sep "Per priorità" con `data-sep="tier"`.
- **CSS** (`html.exercise-mode`):
  - `.ml-item .ml-dot{background:var(--border)!important}` (niente colore tier)
  - `.ml-item .ml-score{display:none}` (niente punteggio/badge)
  - `.ml-item .ml-snippet{display:none}` e `.ml-item .ml-foot .strat{display:none}` (niente trigger/strategia)
  - `.ml-folders [data-sep="tier"], .ml-folders li[data-folder^="tier:"]{display:none}` (cartelle priorità)

### 3. Dettaglio: pannello esercizio + reveal + confronto (`studio.js` + `studio.css`)
In `renderDetail`, quando `exerciseMode`:
- **Non rivelato** (`!STATE.revealed[key]`): aggiungi classe `exercise-hidden` al pannello
  `#ml-detail`, forza `STATE.detailTab="profile"`, e **prependi al `.ml-detail-body`** un riquadro
  `.exercise-panel`:
  - titolo "Modalità esercizio" + istruzione "Osserva il profilo e ipotizza la criticità.";
  - 4 bottoni selezionabili **Critica/Alta/Media/Bassa** (mappano a CRITICAL/HIGH/MEDIUM/LOW);
  - bottone **"Rivela criticità"** disabilitato finché non si è scelta un'ipotesi.
  - CSS `html.exercise-mode .ml-detail-pane.exercise-hidden`: nasconde `.tier` (titolo),
    `.ml-detail-meta`, la tab `.dtab[data-tab="nba"]` e il pane `.tab-pane[data-tab="nba"]`.
- **Rivelato**: prependi al body un banner `.exercise-result` con
  «La tua ipotesi: **<label>** — Reale: **<label>** ✓/✗» (verde se coincide, rosso altrimenti),
  e mostra il dettaglio normale (nessuna classe `exercise-hidden`).
- Il tier reale è già disponibile da `it.tier` (bulk) / `STATE.lastResult.priority_tier`.
- `TIER_LABELS_IT = { CRITICAL:"Critica", HIGH:"Alta", MEDIUM:"Media", LOW:"Bassa" }`.
- `revealExercise(it)`: salva `STATE.hypotheses[key]`, imposta `STATE.revealed[key]=true`, re-render
  del dettaglio (riapre `loadAnagrafica(it)` o `renderDetail(it)`), così compaiono NBA + banner.

## Data flow
Toggle ON → `html.exercise-mode` → CSS nasconde lista/cartelle/dettaglio; apertura record →
pannello ipotesi → scelta tier → "Rivela" → `revealed[key]=true` → re-render → NBA visibile +
banner confronto. Cambio record → di nuovo nascosto (revealed è per-record). Toggle OFF →
azzera revealed/hypotheses → tutto visibile.

## Non-obiettivi (YAGNI)
- Ipotesi non salvata né esportata; nessuna statistica indovinate/sbagliate.
- Nessuna protezione "a prova di ispezione DOM".

## Testing
- Toggle ON: lista senza colore/punteggio/snippet, ordine per id; cartelle "Per priorità" assenti;
  cartella tier attiva → reset a "Tutti".
- Dettaglio non rivelato: solo Profilo, niente tier/NBA; pannello ipotesi; "Rivela" disabilitato
  finché non scelgo.
- Scelgo "Alta" → "Rivela" attivo → click → compaiono NBA + banner "ipotesi Alta — Reale <X>" con ✓/✗.
- Cambio anagrafica → di nuovo nascosto. Toggle OFF → tutto torna visibile.
- `node --check tangible_lab/static/studio.js`.

## Rischi
- Re-render del dettaglio al reveal: assicurarsi che `loadAnagrafica`/`renderDetail` non perda lo
  stato (riapre lo stesso record). Mitigazione: passare lo stesso `it` selezionato.
- Hiding via CSS: i dati restano nel DOM (accettabile, vedi non-obiettivi).
