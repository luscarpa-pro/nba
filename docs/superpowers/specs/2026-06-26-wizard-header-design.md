# Design — Wizard creazione anagrafica + riordino header

Data: 2026-06-26

## Contesto e problema

NBA Studio è ora un'app offline single-user per testare il motore NBA. Due attriti UX:
1. **Creare un'anagrafica di test** apre subito un form lungo (tutte le sezioni dello
   schema) — poco guidato per chi deve costruire uno scenario da testare.
2. **L'header** ha troppi elementi (user-chip, Check-up, Guida, Tutorial, Strumenti) ed è
   dispersivo; l'user-chip è vestigiale (single-user, nessun utente) e "Strumenti" non è
   chiaro per un utente poco preparato.

## Obiettivi

- Un **wizard scenario-builder** a step che guida la creazione del record di test
  impostando i driver dell'NBA, per cliente e per lead.
- Un **header più pulito**: via l'user-chip e il link Tutorial; "Strumenti" → "Dati".

## Non-obiettivi (YAGNI)

- Nessun cambiamento al motore o agli endpoint.
- Il wizard NON gestisce `insurance_needs` (struttura annidata): per i record creati a mano
  le scoperture si impostano col campo `cross_sell_gaps` (che il motore usa come fallback).
- Non si rimuovono funzioni dalla pagina Strumenti/Dati (import/export/reseed restano).

## Vincoli

- Solo `tangible_lab/static/` (`studio.js`, `studio.css`, `index.html`, `admin.js`, `admin.html`).
- Lingua italiana. Riuso dei renderer e stili esistenti.
- Nessun framework di test: verifica via `node --check` + boot reale / Playwright.

---

## Parte A — Wizard "Nuova anagrafica" (scenario-builder)

Sostituisce l'attuale flusso del pulsante **"Nuova anagrafica"** (oggi: prompt tipo →
form completo). Diventa un **overlay a step** con barra di avanzamento e
Indietro / Avanti / Salta / Crea.

### Struttura

**Step 0 — Tipo:** due card, *Cliente* o *Lead*. La scelta inizializza un record vuoto
(`emptyRecord(type)`).

**Cliente** (5 step + riepilogo):
1. **Identità & contatti** — campi: `client_id` (proposto automaticamente, editabile),
   `email`, `phone`, `preferred_channel`.
2. **Polizze** — editor array `policies` (`product`, `premium`, `expiry_date`,
   `churn_rate`). Guida rinnovi, valore, rischio mono-polizza.
3. **Pagamenti & relazione** — `unpaid_days`, `last_contact_days`, `birthday_days`,
   `anniversary_days`, `checkup_done`.
4. **Scoperture (cross-sell)** — `cross_sell_gaps` (enumArray con la tassonomia bisogni).
5. **VIVA & campagne** *(facoltativo)* — `viva_enrolled`, `viva_points`,
   `viva_points_expiring`, `active_campaigns`.
6. **Riepilogo & crea** — anteprima dei trigger che si attiverebbero (chiamando
   `/nba/client/preview` sul record in costruzione) + pulsante **"Crea e testa"**.

**Lead** (2 step + riepilogo):
1. **Dati lead** — `lead_id` (auto), `product`, `marketing_consent`.
2. **Timing & preventivo** — `created_hours_ago`, `last_contact_days`, `quote_premium`,
   `coverage_start_days`.
3. **Riepilogo & crea** — anteprima trigger (`/nba/lead/preview`) + "Crea e testa".

### Comportamento

- Ogni step renderizza un sottoinsieme di campi **riusando i renderer esistenti**
  (`renderField` per i campi semplici; il renderer di sezione-array esistente per
  `policies` / `active_campaigns`). Gli step costruiscono mini-sezioni a partire dalle
  definizioni di campo già presenti in `CLIENT_SCHEMA`/`LEAD_SCHEMA` (selezionate per `k`),
  così le label/tipi restano coerenti e non si duplica la definizione dei campi.
- Lo stato del wizard è un **record di lavoro** (`emptyRecord(type)` mutato in place dai
  campi), + indice di step. Indietro/Avanti navigano; "Salta" sugli step facoltativi
  prosegue lasciando i default.
- **"Crea e testa"**: imposta `STATE.record` = record di lavoro e apre il dettaglio come
  fa oggi `openNewDraft` (kind `new`), poi esegue l'NBA. Da lì l'utente può "Salva caso".
- Apertura: il pulsante **"Nuova anagrafica"** (sidebar, `#ana-new`) apre il wizard invece
  del prompt+form. Chiusura con "Annulla", Esc o click sullo sfondo.

### Stile

Overlay coerente con l'esistente (riuso del pattern `.tut-overlay`/pannello): pannello
centrato con header (titolo step + barra avanzamento), corpo scrollabile coi campi,
footer con i pulsanti. Mobile-safe (`max-width`, `overflow:auto`).

---

## Parte B — Header (pulizia minima)

In `studio.js` (`init`, blocco header `.actions`):
- **Rimuovere** l'intero blocco **user-chip** (chip "admin" + dropdown).
- **Rimuovere** il link **Tutorial** (`helpBtn`). Il tutorial continua a comparire al
  primo avvio.
- **Mantenere** i link diretti **Check-up** e **Guida**.
- **Rinominare** il link ex-"Strumenti" (→ `admin.html`) in **"Dati"** (icona `database`),
  più chiaro per un novizio (è dove si importa/esporta).

In `admin.html` / `admin.js` (pagina "Dati"):
- Titolo/etichette: "Strumenti" → **"Dati"**.
- Aggiungere in fondo due link discreti: **"Tool originale Vittoria"** (href `/`) e
  **"Rivedi tutorial"**.
- "Rivedi tutorial" naviga a **`/lab/?tutorial=1`**; in `studio.js` `init`, se l'URL ha
  `?tutorial=1`, chiama `showTutorial()` e ripulisce il parametro. Così il tutorial resta
  richiamabile senza un link fisso in header.

---

## Testing

- **Wizard**: dal pulsante "Nuova anagrafica" si apre l'overlay; navigazione step
  avanti/indietro/salta; per un cliente con insoluti+scadenze+gap il riepilogo mostra i
  trigger attesi; "Crea e testa" apre il dettaglio col record e l'NBA eseguito. Idem lead.
- **Header**: nessun user-chip né link Tutorial; presenti Check-up, Guida, "Dati"; la
  pagina Dati mostra import/export/reseed + i due link; `/lab/?tutorial=1` apre il tutorial.
- `node --check studio.js` e `admin.js`; verifica visiva via Playwright sul binario.

## Rischi

- Il wizard è la parte più ampia: l'editor array `policies` va riusato dall'esistente per
  non divergere. Resta solo-frontend, nessun impatto su dati/motore.
