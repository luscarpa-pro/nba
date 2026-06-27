# Design — Esercizio: ordina le azioni per priorità (vere/false)

Data: 2026-06-27

## Contesto
Estende la **Modalità esercizio**: oltre a ipotizzare la criticità, il tester ordina per
priorità un set di azioni — alcune **reali** (raccomandate dal motore per quel cliente),
altre **esche** (false). Alla rivelazione si verifica quali erano reali/false e se l'ordine
delle reali rispetta la priorità del motore. Tutto effimero, dentro l'esercizio di un record.

## Decisioni (dal brainstorming)
- **Totale fisso 5 card**: fino a **4 reali** + **esche** (da pool fisso) fino ad arrivare a 5,
  quindi **sempre ≥1 esca**; ordine iniziale **mescolato**.
- **Ordinamento drag & drop**.
- **Verifica = vere/false + ordine**: ogni card marcata reale ✓ / esca ✗; verdetto sull'ordine
  delle reali (corrette se in ordine di priorità motore: l'array `recommended_actions` è già
  primary-first).
- **Un unico esercizio**: criticità → ordina azioni → "Rivela" mostra entrambi i confronti.

## Componenti (solo `tangible_lab/static/studio.js` + `studio.css`)

### Dati
- `buildItems`: salvare le azioni reali sull'item predef → `nba: c.nba || []` (e `l.nba`).
- `STATE.exerciseActions = {}` (reviewKey → array di card nell'ordine corrente del giocatore),
  effimero; azzerato con `revealed`/`hypotheses` allo spegnimento della modalità.
- Pool esche: costante `DECOY_ACTIONS` (~10 testi plausibili in italiano, non raccomandati).
- Ogni card: `{ text, isReal, rank }` — `rank` = indice di priorità nel motore (0 = top) per le
  reali, `null` per le esche.

### Costruzione del set (una volta per record, in `buildExercisePanel`)
```
reals = (it.nba||[]).slice(0,4).map((a,i) => ({text: reviseMessage(a.action_category, a.recommended_action), isReal:true, rank:i}))
decoys = pickDecoys(5 - reals.length, testiReali)   // dal pool, escludendo testi uguali ai reali
cards = shuffle([...reals, ...decoys])              // ordine iniziale mescolato
STATE.exerciseActions[key] = cards
```
Se `it.nba` ha >4 azioni si prendono le prime 4 (così resta ≥1 esca). Se 0 reali (raro) → 5 esche.

### UI pannello esercizio (esteso)
Sotto i bottoni criticità, una sezione **"Ordina le azioni per priorità (dalla più alla meno
prioritaria)"** con la lista drag & drop delle 5 card (`draggable`). Il drag riordina sia il DOM
sia `STATE.exerciseActions[key]`. Il bottone **"Rivela"** resta attivo dopo aver scelto la
criticità (l'ordine ha sempre uno stato).

### Rivelazione (in `buildExerciseResult`, estesa)
1. **Criticità**: banner ipotesi vs reale (✓/✗) — invariato.
2. **Azioni**: la lista nell'ordine finale del giocatore; ogni card mostra:
   - reale → ✓ "Reale · priorità motore N" (N = rank+1);
   - esca → ✗ "Esca — non raccomandata".
3. **Ordine**: verdetto "Ordine delle azioni reali: corretto/da rivedere" — corretto se i `rank`
   delle reali, nell'ordine scelto dal giocatore, sono crescenti (0,1,2,…).

### Drag & drop
HTML5 `draggable` sulle card: `dragstart` memorizza l'indice, `dragover` (preventDefault) +
`drop` riordinano l'array `STATE.exerciseActions[key]` e ri-renderizzano la lista. Indicatore
visivo `.dragging`/`.drag-over`.

## Data flow
Apertura record in esercizio → pannello (criticità + 5 card mescolate) → il giocatore sceglie
criticità e trascina le card → "Rivela" → `revealed[key]=true` → re-render con i due confronti.
Cambio record → nuovo set. Toggle OFF → tutto azzerato.

## Non-obiettivi (YAGNI)
- Esche non su misura del cliente (pool fisso generico).
- Nessun punteggio/scoring complessivo, nessun salvataggio/export dell'esercizio.

## Testing
- In esercizio, aperto un record: 5 card ordinabili + i 4 bottoni criticità; "Rivela" attivo
  dopo la criticità.
- Drag riordina le card.
- "Rivela": banner criticità + lista azioni con ✓/✗ e priorità motore; verdetto ordine corretto
  se le reali sono in ordine di rank crescente (testabile riordinando a mano).
- Sempre ≥1 esca tra le 5. Cambio record → nuovo set mescolato.
- `node --check tangible_lab/static/studio.js`.

## Rischi
- `it.nba` deve essere salvato sull'item (altrimenti niente reali). Mitigazione: aggiunto in
  `buildItems` (verifica in test che le card reali compaiano).
- Drag & drop su touch: l'HTML5 DnD è limitato su mobile; accettabile (uso desktop in sessione).
