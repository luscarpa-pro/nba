# Design — Pesature globali (config editor a livello complessivo)

Data: 2026-06-26

## Contesto e problema

Oggi "Confronta pesature" è un **tab per-record** nel dettaglio dell'anagrafica: sposti
gli slider (pesi, tier, soglie, premi) e fai un confronto A/B **solo per quel record** —
una simulazione locale che non cambia nulla davvero. Ma pesi/tier/soglie sono
**configurazione globale del motore**: ha senso tararli una volta e applicarli a tutti.

## Obiettivo

Spostare le pesature dal livello di singola anagrafica a un'**area globale**: un pannello
che modifica la configurazione e, con un'azione, la **applica a tutte** le anagrafiche
(persistendo e ri-calcolando i punteggi). Più un ripristino ai valori originali.

## Approccio

Riuso l'editor già esistente (`renderCmpEditor` + le sezioni `cmp*` + `buildCmpConfig`),
lo sposto in un **pannello/overlay globale** aperto da un link "Pesature" nell'header
dello Studio, e collego le azioni al backend:
- **Applica a tutti** → `PUT /config` (persiste `nba_config.json` + `reload_config`) →
  ricarico la lista (re-score di tutti).
- **Ripristina default** → nuovo endpoint che re-seeda la config originale + reload.
Rimuovo il tab "Confronta pesature" dal dettaglio per-record.

## Fatti tecnici (verificati)

- `PUT /config` (in `nba_api.py`) scrive la config e chiama `reload_config()`.
- `buildCmpConfig()` parte da `deepClone(STATE.config)` e sovrascrive solo le sezioni
  editate → produce una config **completa e valida** (preserva l'altro tipo di pesi).
- L'editor (`cmpModeBtn` + `renderCmpEditor`) e lo stato `cmp*` sono oggi accoppiati a
  `STATE.selected?.type`. Rimosso il per-record, restano usati solo dal pannello globale.

## Componenti

1. **Link header "Pesature"** (icona `tune`) nell'header Studio, accanto a Check-up/
   Guida/Dati → apre il pannello.
2. **Pannello globale** (overlay, stile coerente con wizard/tutorial): contiene le
   **mode tabs** (Pesi · Soglie priorità · Rischio churn · Soglie lead · Boost trigger ·
   Premi medi · JSON) e l'editor dinamico (`renderCmpEditor`), **senza** la parte A/B
   per-record (niente snapshot/"Esegui confronto"). Footer con:
   - **"Applica a tutti"** → `cfg = buildCmpConfig()` → `PUT /config` → su successo
     `STATE.config = cfg` + ricarico clienti/lead (re-score) + toast.
   - **"Ripristina default"** → `POST /lab/admin/config/reset` → su successo ricarico
     `/config` e la lista + toast.
   - **"Chiudi"**.
3. **Decoupling editor**: il pannello edita i **pesi CLIENT** (caso principale). Le
   funzioni `initCmpFromConfig`/`buildCmpConfig`/`weightFactorsFor` usano un tipo
   "client" fisso quando si è nel pannello globale (non più `STATE.selected?.type`),
   così funziona anche senza un record selezionato. `lead_weights` resta ai valori
   correnti (preservati da `buildCmpConfig`).
4. **Rimozione per-record**: tolto il tab `data-tab="compare"` dal dettaglio (button +
   pane + voce "compare" dalla lista tab valide). Resta la "Composizione del punteggio"
   (breakdown read-only) nel risultato NBA.

## Backend (server.py)

Nuovo endpoint **`POST /lab/admin/config/reset`** (require_admin): copia la config di
default (bundle/repo `nba_config.json`, già accessibile come sorgente di seed) su
`nba_config.CONFIG_JSON_PATH`, poi `nba_config.reload_config()`. Risponde `{status:"ok"}`.
Nessuna modifica ai file vendored.

## Data flow

Apri "Pesature" → editor inizializzato dalla config corrente (`/config`) → modifichi gli
slider → **Applica a tutti**: `PUT /config` persiste e ricarica il motore, poi il
frontend ricarica `/nba/clients` (+lead) e la lista si ri-ordina coi nuovi punteggi.
**Ripristina default**: re-seed + reload + ricarica lista.

## Non-obiettivi (YAGNI)

- Niente toggle client/lead nel pannello (v1 edita i pesi client; i pesi lead restano).
- Nessun versionamento/cronologia delle config (gli "snapshot" locali esistenti non sono
  in scope qui).
- L'A/B per-record viene rimosso, non sostituito con un equivalente.

## Testing

- **Apply**: modifico un peso → "Applica a tutti" → `/config` riflette il nuovo valore e
  la distribuzione tier cambia coerentemente; persiste dopo reload pagina.
- **Reset**: dopo un apply custom, "Ripristina default" riporta i pesi originali; lista
  ri-calcolata.
- **Rimozione**: il dettaglio anagrafica non ha più il tab "Confronta pesature"; la
  "Composizione del punteggio" è ancora presente.
- `node --check studio.js`/`admin? n/a`; boot reale + verifica via Playwright.

## Rischi

- L'editor `cmp*` era record-coupled: il decoupling va fatto con cura (ma il per-record è
  rimosso, quindi nessun consumatore residuo). `PUT /config` scrive la config persistente
  in `%APPDATA%`: "Ripristina default" è la rete di sicurezza.
