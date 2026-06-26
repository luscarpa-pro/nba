# Design — Ritocchi al pannello di dettaglio (tab, Perché, scoperture, azioni)

Data: 2026-06-26

## Contesto e problema

Nel dettaglio dell'anagrafica: le tab NBA/Profilo sono poco evidenti; la sezione "Perché
questa priorità?" occupa molto spazio sempre aperta; il riquadro "Scoperture rilevate" è
in cima al Profilo (slegato dal contesto VIVA/bisogni); e l'header ha due pulsanti
ridondanti ("Esegui NBA" — l'NBA parte da solo all'apertura; "Modifica record" — duplica
il "Modifica" già presente dentro la tab Profilo).

## Obiettivi

1. Rendere più evidenti le tab **NBA** e **Profilo**.
2. "Perché questa priorità?" **comprimibile, chiusa di default**.
3. Spostare "Scoperture rilevate" **dopo la sezione "VIVA Points"** del Profilo.
4. Rimuovere dall'header i pulsanti **"Esegui NBA"** e **"Modifica record"**; far sì che
   il **"Salva modifiche"** della tab Profilo **ricalcoli l'NBA** (rimpiazzando "Esegui NBA").

## Vincoli

- Solo `tangible_lab/static/studio.js` e `studio.css`. Nessun backend.
- Lingua italiana. Riuso degli helper/funzioni esistenti.
- Niente framework di test: `node --check` + verifica Playwright.

## Componenti

### 1. Tab più evidenti (CSS)
Restyle di `.detail-tabs` / `.dtab` in **segmented control**: contenitore a pillola con
sfondo tenue, tab più grandi (padding maggiore, icona+label), tab attiva con **fondo
pieno e colore primario**. Solo `studio.css` (nessuna modifica al markup dei bottoni).

### 2. "Perché questa priorità?" comprimibile
La card (oggi `section-block` con `section-head` + `section-body(renderExplanation)`)
diventa **collassabile**: l'header diventa cliccabile con un chevron; il corpo è
**nascosto di default** e si mostra al click (toggle di una classe, es. `.collapsed`).
Stato non persistito (riparte chiusa a ogni apertura). Le card "Azioni" e "Composizione
del punteggio" restano invariate (sempre visibili).

### 3. "Scoperture rilevate" dopo "VIVA Points"
Oggi il `#profile-gaps` è inserito in cima al Profilo (prima del form) e `fillProfileGaps`
lo popola dall'NBA. Va spostato **dopo la sezione "VIVA Points"** del form.
- Si estrae un unico helper `renderProfileBody(pane)` usato sia alla costruzione iniziale
  (in `renderDetail`) sia in `rerenderProfilePane` (post Modifica/Salva/Annulla): costruisce
  intro + form (`renderForm`/`renderFormView` secondo `profileEdit`) e poi inserisce il
  riquadro scoperture **subito dopo il `.section-block` "VIVA Points"** (individuato per
  intestazione), infine chiama `fillProfileGaps()`.
- Risolve anche l'incoerenza attuale: oggi `rerenderProfilePane` ricostruisce il Profilo
  **senza** il riquadro scoperture (che quindi sparisce dopo un edit).

### 4. Header azioni + ricalcolo su salvataggio
- In `renderDetail`, nella riga `.ml-detail-actions`, **rimuovere** i bottoni "Esegui NBA"
  (`id="detail-run"`) e "Modifica record". **Restano** "Salva caso" e "Elimina" (sui casi
  salvati).
- La tab Profilo mantiene il proprio flusso: read-only con bottone **"Modifica"** →
  edit con **"Salva modifiche"** / **"Annulla"** (in `buildProfileIntro`, invariato).
- **`saveProfileEdit`**: dopo `rerenderProfilePane()`, chiamare **`runNBA()`** per
  ricalcolare la priorità sui campi modificati; aggiornare il toast a "Modifiche applicate
  — NBA ricalcolato". (`runNBA` aggiorna `#result-box` e `fillProfileGaps`.)

## Data flow

Apertura anagrafica → NBA auto-eseguito (invariato). Tab Profilo: "Modifica" → editi →
"Salva modifiche" → `rerenderProfilePane` + `runNBA` → la tab NBA e le scoperture si
aggiornano. "Annulla" ripristina il backup.

## Non-obiettivi (YAGNI)

- Niente Profilo "sempre editabile" né auto-ricalcolo a ogni tasto: il ricalcolo avviene
  su "Salva modifiche".
- Nessuna persistenza dello stato aperto/chiuso del "Perché".

## Testing

- Tab: visivamente segmented control; la tab attiva evidenziata.
- Perché: card chiusa all'apertura; click espande/comprime.
- Scoperture: il riquadro compare dopo "VIVA Points"; resta presente dopo un ciclo
  Modifica→Salva.
- Azioni: header senza "Esegui NBA"/"Modifica record"; modificando un campo nel Profilo e
  premendo "Salva modifiche" il punteggio NBA cambia (verifica Playwright).
- `node --check tangible_lab/static/studio.js`.

## Rischi

- Individuare la sezione "VIVA Points" per intestazione è un po' fragile: se l'etichetta
  cambia, il riquadro tornerebbe in coda al form (degradazione innocua, non un crash).
