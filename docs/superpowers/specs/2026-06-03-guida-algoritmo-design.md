# Design — Area "Guida: come funziona" in NBA Studio

Data: 2026-06-03
Stato: approvato da Luca

## Obiettivo

Portare dentro NBA Studio (`/lab/`) un'area divulgativa che spiega il funzionamento
dell'algoritmo NBA a un'audience non tecnica (operatori, stakeholder Vittoria),
basata sui documenti `tangible_lab/_docs/NBA_Bozza_Guida_Funzionamento_v1.docx` /
`.pptx` ma con due miglioramenti chiave:

1. **Valori sempre live**: pesi, soglie e tier letti da `/config` a runtime —
   mai numeri hardcodati che vanno fuori sync con la configurazione reale.
2. **Correzioni rispetto ai documenti sorgente**:
   - aggiunta la terza regola di override (sinistro/reclamo aperto → azione
     primaria forzata a RELATIONSHIP, che precede perfino il sollecito pagamento);
   - eliminata la contraddizione sui pesi lead (il testo dirà ciò che dicono i
     numeri live, non "il timing pesa di più" con una tabella che dice il contrario);
   - i pesi/soglie presentati come configurabili, non come costanti.

## Vincoli

- Tutto dentro `tangible_lab/` (il resto del repo è codice IT Vittoria, read-only).
- Nessun endpoint backend nuovo: si usano `/config` (GET),
  `/lab/breakdown/client` (POST), `/nba/client/test` (POST), `/lab/api/me`.
- Lingua italiana, palette/tipografia esistenti (`studio.css`).
- Nessuna dipendenza nuova: vanilla JS come il resto della Lab.

## Componenti

| File | Ruolo |
| --- | --- |
| `tangible_lab/static/guida.html` | Markup della pagina: header Lab, sommario sticky, sezioni con placeholder `data-cfg` per i valori live |
| `tangible_lab/static/guida.js` | Auth gate (`/lab/api/me` → 401 redirect login), fetch `/config`, iniezione valori, logica dei 3 widget |
| `tangible_lab/static/guida.css` | Stili specifici della pagina (riusa le variabili di `studio.css`) |
| `index.html`, `checkup.html`, `admin.html` | Aggiunta link "Guida" nell'header (icona `menu_book` + label, pattern esistente) |

## Struttura della pagina

1. **Introduzione** — le 3 domande (chi/cosa/come), cosa produce la lista,
   note di eleggibilità (cliente senza telefono né email escluso; lead senza
   consenso marketing non elaborato).
2. **Parte 1 — Il cliente esistente**
   - Passo 1: i 15 segnali (tabella, con soglie live dove configurabili:
     90gg contatto, finestra 45gg scadenza, ecc.)
   - Passo 2: le 4 dimensioni dello score → **widget pesi**
   - Passo 3: i tier → **widget slider score→tier** + le **3 regole di override**
   - Passo 4: categoria strategica (Retention > Growth > Service)
   - Passo 5: azione generata e canale (3 ordini di fallback come diagramma statico)
   - **Widget esempio cliente** con breakdown live
3. **Parte 2 — Il lead** — perché è diverso, i 5 segnali (soglie live:
   ore "nuovo lead", 10gg stale, 14gg decorrenza, €1.900), le 3 dimensioni
   (widget pesi, stessa componente del cliente), categorie Conversion/Nurturing,
   canale default telefono.
4. **Parte 3 — Uso quotidiano** — le 5 azioni della routine operativa.

## I tre widget

1. **Pesi delle dimensioni** (cliente e lead): barre orizzontali con i pesi
   attuali normalizzati in % per leggibilità. Nota esplicita: i pesi sono
   moltiplicatori configurabili e possono cambiare. Fonte: `/config` →
   `client_weights` / `lead_weights`.
2. **Slider score → tier**: input range 0–100; il tier risultante si colora
   (CRITICAL rosso / HIGH arancio / MEDIUM giallo / LOW verde) usando le soglie
   live da `/config` → `tiers`. Le soglie sono marcate sulla barra.
3. **Esempio cliente demo**: record cliente curato, embedded in `guida.js`;
   al load chiama `/lab/breakdown/client` e mostra contributi per dimensione,
   bonus (multi-trigger, relazione), eventuale churn override e score/tier
   finale. Il testo intorno spiega come leggerlo. Le date assolute del record
   (es. `expiry_date` delle polizze) sono calcolate in JS relative a "oggi"
   (es. oggi + 10 giorni), così l'esempio resta stabile nel tempo e i trigger
   attesi non cambiano col passare dei mesi.

## Flusso dati

```
load → GET /lab/api/me ──401──→ redirect /lab/login.html
     → GET /config ──→ inietta valori nei placeholder [data-cfg] + widget 1-2
     → POST /lab/breakdown/client (demo record) ──→ widget 3
```

## Gestione errori

- `/config` non disponibile → placeholder mostrano "—", banner discreto
  "Valori di configurazione non disponibili al momento"; il testo resta leggibile.
- Breakdown fallisce → il widget esempio si nasconde con messaggio breve.
- Nessun errore bloccante: la pagina è leggibile anche offline dal backend.

## Verifica

- Server locale (`python tangible_lab/server.py`), controllo con Playwright:
  desktop + viewport mobile.
- Verifica incrociata: i numeri mostrati nella pagina == valori in `/config`.
- Verifica auth: pagina non raggiungibile da non loggati (redirect login).

## Fuori scope (decisioni esplicite)

- Simulatore interattivo del canale (resta diagramma statico).
- Spiegazioni contestuali dentro lo Studio (possibile evoluzione futura).
- Modifica dei documenti Word/PPT sorgente (restano in `_docs/` come bozze).
