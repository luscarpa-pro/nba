# NBA Studio — Tangible Lab

Area di test sviluppata da Tangible per Vittoria Assicurazioni, **isolata** dal
codice del cliente. Tutti i file di questa estensione vivono in
`tangible_lab/` e non toccano `nba_api.py`, `nba_engine.py`, `nba_config.py`,
`nba_catalog.py`, `dataset.json`, `static/` né nessun altro file del
backend Vittoria.

## Avvio

Dalla root del repo:

```bash
python tangible_lab/server.py
```

Il browser si apre su <http://127.0.0.1:8000/lab/> (o porta libera successiva
se la 8000 è già occupata).

Lo stesso file `tangible_lab/server.py` importa `nba_api:app` (il backend
del cliente) ed espone tutti gli endpoint originali (`/nba/clients`,
`/nba/leads`, `/config`, ecc.) — è quindi un drop-in che fa girare TUTTO,
ma in più monta `/lab` sui file statici di Tangible.

In alternativa potete continuare a usare `python nba_api.py` (il launcher
originale del cliente): la Lab non sarà raggiungibile, ma il resto
funziona normalmente.

## Aggiornamenti dal cliente

Se Vittoria invia una nuova versione del software (`nba_api.py`,
`nba_engine.py`, `dataset.json`, ecc.), la procedura è:

1. Sostituire i file del backend con quelli nuovi.
2. Lasciare invariata la cartella `tangible_lab/`.
3. Riavviare con `python tangible_lab/server.py`.

Finché il backend espone ancora gli endpoint usati dalla Lab (lo abbiamo
verificato nel commento in testa a `server.py`), tutto continua a girare.

## Struttura

```
tangible_lab/
├── README.md
├── server.py             ← wrapper che monta /lab su nba_api:app
└── static/
    ├── index.html        ← entrypoint dell'app
    ├── studio.js         ← logica della UI
    ├── studio.css        ← stile (palette Tangible)
    ├── assets/
    │   ├── tangible.svg
    │   └── vittoria.svg
    └── lib/
        └── xlsx.full.min.js   ← SheetJS per import/export Excel (offline)
```

## Persistenza dati utente

I dati creati dall'utente dentro la Lab (casi salvati, snapshot di
configurazione, giudizi sui casi, stato della sidebar, tab attiva) sono
salvati nel `localStorage` del browser, per chiave:

| chiave | contenuto |
| --- | --- |
| `nba.lab.cases`     | casi di test salvati con nome |
| `nba.lab.snapshots` | snapshot delle configurazioni di confronto |
| `nba.lab.reviews`   | giudizi operatore sui casi (Corretto/Sbagliato/Da verificare + note) |
| `nba.lab.sidebar.collapsed` | preferenza UI (sidebar collassata) |
| `nba.lab.detail.tab`        | ultima tab del detail attiva (NBA/Profilo/Confronta) |
| `nba.lab.hideReviewed`      | filtro "Nascondi analizzati" |

Sono **per-utente / per-browser**: ogni operatore tiene i suoi nella propria
sessione. Se in futuro si decide di condividere i giudizi tra team,
serviranno endpoint backend dedicati (oggi non ci sono, e la Lab non
introduce dipendenze sul filesystem del server).

## Dipendenze runtime

- Python 3.10+ con `fastapi` e `uvicorn[standard]` (già installati per
  il backend del cliente; nessuna libreria aggiuntiva richiesta lato server).
- Browser moderno (Chrome / Edge / Safari / Firefox recenti). La Lab
  usa solo vanilla JS, fetch API, Material Symbols (Google Fonts via CDN
  per le icone) e SheetJS (incluso in locale).

## Note sul deploy online

Per pubblicare la Lab in produzione si veda la conversazione di
preparazione: l'idea è impacchettare `tangible_lab/` insieme al backend
Vittoria in un container, esporlo dietro Basic Auth e (eventualmente)
montare `/data` come volume persistente per la condivisione delle config.
