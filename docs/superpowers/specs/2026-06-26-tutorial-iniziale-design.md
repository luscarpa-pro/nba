# Design — Tutorial di utilizzo iniziale (overlay di benvenuto)

Data: 2026-06-26

## Contesto e problema

NBA Studio è ora distribuito offline (un `.exe`/binario per PC) e parte **vuoto**
(nessun dataset finché non lo si importa). Un nuovo tester che apre l'app non sa da dove
cominciare. Serve un breve tutorial di **utilizzo iniziale** (distinto dalla `guida.html`
esistente, che spiega il *funzionamento dell'algoritmo*).

## Obiettivo

Un overlay di benvenuto che, al primo avvio, spiega in 5 passi come usare l'app, e che
resta richiamabile in seguito.

## Approccio

Overlay informativo (un pannello centrato) renderizzato dallo Studio. Si mostra
automaticamente al primo avvio (flag `localStorage`), si chiude con "Ho capito" (che
imposta il flag così non riappare da solo) ed è riapribile da un pulsante "?" nell'header.
Nessuna modifica al backend.

## Non-obiettivi (YAGNI)

- Niente tour interattivo con evidenziazione degli elementi della pagina (solo pannello).
- Niente carosello multi-slide: un unico pannello con elenco numerato.
- Nessun contenuto sul *funzionamento dell'algoritmo* (è già in `guida.html`).

## Vincoli

- Lavorare solo in `tangible_lab/static/` (`studio.js`, `index.html`, `studio.css`).
- Lingua italiana. Riusare lo stile esistente.
- Nessun framework di test: verifica via `node --check` + boot reale.

## Componenti

1. **Markup overlay** — un contenitore overlay (sfondo semitrasparente + pannello
   centrato) con: titolo "Come iniziare", elenco numerato dei 5 passi, pulsante
   "Ho capito". Reso nascosto di default. Collocazione: costruito in `studio.js`
   (coerente con header/chips già costruiti via JS) e appeso al `body`, oppure blocco
   nascosto in `index.html`; la scelta esatta è di piano.
2. **Logica show/hide** — in `init()` dello Studio: se
   `localStorage.getItem("nba.lab.tutorial.seen")` è assente → mostra l'overlay.
   "Ho capito" → nasconde + `localStorage.setItem("nba.lab.tutorial.seen", "1")`.
   Chiusura anche con click sullo sfondo e tasto `Esc`.
3. **Pulsante "?" nell'header** — accanto ai link Guida/Strumenti (zona
   `headerActions`, dove sono già creati i link Check-up/Guida): apre l'overlay on-demand
   (senza toccare il flag).

## Contenuto — 5 passi (testo verbatim)

Titolo overlay: **"Come iniziare"**

1. **Benvenuto in NBA Studio** — Ambiente Tangible per testare e validare le
   raccomandazioni del motore NBA di Vittoria.
2. **Importa i dati** — L'app parte vuota: vai su **Strumenti → Importa dataset** e
   carica il file `dataset.json`.
3. **Esplora le anagrafiche** — Nella lista a sinistra trovi clienti e lead con tier e
   punteggio; filtra per tier o tipo dalla sidebar.
4. **Leggi la raccomandazione** — Selezionando un'anagrafica, nel pannello a destra vedi
   il **Perché** (i trigger), le **Azioni consigliate** e il **breakdown** del punteggio.
5. **Valuta ed esporta** — Dai un **giudizio** (ok / ko / incerto), aggiungi una **Nota**,
   poi da **Strumenti → Scarica Excel** esporti tutto per condividere le considerazioni.

Pulsante di chiusura: **"Ho capito"**.

## Data flow

`init()` (Studio) → controlla `nba.lab.tutorial.seen` → se assente mostra l'overlay.
"Ho capito"/Esc/click-sfondo → nasconde; "Ho capito" imposta il flag. Il pulsante "?"
nell'header riapre l'overlay in qualsiasi momento.

## Stile

Riusare le variabili/classi esistenti di `studio.css` (palette, ombre, bottoni
`.btn`/`.btn primary-cta`). Overlay: full-screen semitrasparente + pannello con
`max-width` ~520px, centrato, scrollabile su viewport piccoli. Il pannello non deve far
scrollare orizzontalmente il body (mobile-safe).

## Testing

- `node --check tangible_lab/static/studio.js` passa.
- Boot reale: al primo avvio (localStorage pulito / incognito) l'overlay appare; "Ho
  capito" lo chiude e, ricaricando, non riappare; il pulsante "?" lo riapre.
- Nessuna regressione: lo Studio carica e funziona con e senza overlay.

## Rischi

- Minimo: feature solo-frontend, isolata; nessun impatto su dati/backend.
