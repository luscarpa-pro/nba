# Design — Dataset fuori da git + import in locale (versione offline Windows)

Data: 2026-06-25
Autore: Luca Scarpa + Claude

## Contesto e problema

`dataset.json` contiene **PII reali** (email e telefoni veri di ~600 clienti
Vittoria). Il file è attualmente versionato in git, presente nella history, pushato
su GitHub (`luscarpa-pro/nba`) e deployato su Render. È un'esposizione di dati
personali rilevante ai fini GDPR (Tangible opera con DPA Art. 28).

Obiettivo: portare il Lab a una distribuzione **offline su Windows** (vedi
`tangible_lab/DISTRIBUZIONE_WINDOWS.md`) in cui **il dataset reale non sta mai nel
repository né nell'eseguibile**, ma viene caricato localmente da chi testa.

## Obiettivi

- Nessuna PII nel repository (storia inclusa) e nell'eseguibile distribuito.
- L'app/exe parte "di fabbrica" **vuota** di clienti/lead, con i soli **Check-up demo**
  (contenuto non-PII già esistente).
- Un tester admin può **importare** il `dataset.json` reale dalla UI, in locale.
- Storicizzare la versione del progetto precedente all'update del motore, fuori da internet.

## Non-obiettivi (YAGNI)

- Export/download del dataset dalla UI (resta l'export Excel dei risultati).
- Import del dataset via Excel (formato lossy per la struttura annidata; l'Excel
  resta solo per i singoli casi salvati).
- Merge/append incrementale: l'import **sostituisce** integralmente il dataset.
- Multi-utente condiviso (gestito altrove: vedi distribuzione Windows, Modello B).

## Vincoli

- I file fuori da `tangible_lab/` sono vendored del cliente (read-only, sovrascritti
  agli update). **Nessuna modifica** a `nba_api.py`, `nba_engine.py`, ecc.
- Tutto il lavoro avviene in `tangible_lab/` + config repo (`.gitignore`, CI, docs).

## Fatti tecnici rilevanti (verificati)

- `nba_api.load_dataset()` carica il dataset in modo lazy e cacha in `_DATA`. Se il
  file **non esiste** restituisce `{"clients": [], "leads": []}` senza errori.
- Esiste già `nba_api._DATA` (cache) e un endpoint `/dataset/reload` che la azzera.
  Il reload a caldo è quindi disponibile senza toccare i file del cliente.
- A runtime con `TANGIBLE_LAB_DATA_DIR` impostato (caso desktop/exe), `DATASET_PATH`
  punta a `%APPDATA%\NBAStudio\dataset.json`. Il seed copia il file solo se esiste
  in sorgente; assente in sorgente ⇒ nessuna copia ⇒ dataset vuoto.

---

## Parte A — Feature codice (`tangible_lab/`)

### A1. Comportamento dei dati

- **`.gitignore`**: aggiungere `/dataset.json` — il dataset reale non viene mai
  committato. (Il file resta presente in locale durante lo sviluppo, ma ignorato.)
- **PyInstaller spec** (`tangible_lab/nba_studio.spec`): rimuovere la riga
  `(os.path.join(_ROOT, "dataset.json"), ".")` dai `datas`. L'exe non contiene dati.
- Conseguenza: senza `dataset.json`, `load_dataset()` restituisce liste vuote →
  l'app parte senza clienti/lead, senza crash. I Check-up demo (file separati in
  `tangible_lab/checkup/`) restano e continuano a essere seedati.
- All'update del motore dal cliente: si prendono i loro file di engine **ma non** il
  loro `dataset.json` (che è ignorato); il dato reale entra solo via import locale.

### A2. Endpoint di import (solo admin)

`POST /lab/admin/dataset/import` — protetto da `require_admin`.

1. Riceve il contenuto del file: la UI legge il testo del `.json` selezionato e lo
   invia come **body della richiesta** (`Content-Type: application/json`); l'endpoint
   ne fa il parse dal body grezzo. (Niente multipart: evita complessità inutile.)
2. **Valida**: JSON parsabile; deve essere un oggetto con chiavi `clients` e `leads`
   entrambe liste. In caso contrario → `HTTPException 400` con messaggio chiaro,
   **senza** sovrascrivere nulla.
3. Scrive il contenuto validato in `DATASET_PATH` (`%APPDATA%\NBAStudio\dataset.json`)
   in modo atomico (scrittura su file temporaneo + replace).
4. Azzera la cache: `import nba_api; nba_api._DATA = None` (reload a caldo al
   prossimo accesso). In alternativa richiama la logica di `/dataset/reload`.
5. Risponde `{ "clients": N, "leads": M }` per l'esito.

L'endpoint va inserito **prima** del mount statico `/lab` in `server.py` (come gli
altri `/lab/...`), per non essere intercettato.

### A3. UI Admin (`tangible_lab/static/admin.js`)

- Nuova sezione "Dataset": input file (accetta `.json`) + pulsante **Importa**.
- Alla conferma (avviso: "sostituisce il dataset corrente"), invia il file
  all'endpoint e mostra l'esito (`X clienti, Y lead importati`) o l'errore di
  validazione. Dopo l'import, ricarica la lista anagrafiche.

### A4. Casi limite

- Dataset vuoto importato: consentito (azzera la lista).
- File non valido / non JSON / struttura errata: rifiutato, dataset corrente intatto.
- Review/commenti orfani dopo un cambio dataset: comportamento accettato (su
  installazione locale che parte vuota non si presenta).

---

## Parte B — Runbook operativo (repo pulito + bonifica PII)

Azioni distruttive su GitHub/Render: le esegue l'utente; Claude prepara comandi e
checklist.

1. **Bundle storico (storicizzazione #1)**: `git bundle create <archivio>.bundle --all`
   dell'intero repo attuale. Conservato **offline**, in luogo sicuro (contiene PII).
   È l'archivio recuperabile della versione pre-update del motore.
2. **Applicare la Parte A** allo stato attuale (gitignore, spec, endpoint, UI).
3. **Repo nuovo pulito**: nuova history (`git init` su un checkout pulito, oppure
   `git checkout --orphan`) con il working tree corrente già privo di PII e con il
   `.gitignore` aggiornato; primo commit pulito; reintegrare la CI Windows.
4. **Push** sul nuovo repository GitHub.
5. **Cancellare** il vecchio repo `luscarpa-pro/nba` su GitHub (rimuove l'esposizione
   online). Valutare una richiesta a GitHub Support per le cache.
6. **Dismettere Render**: sospendere/eliminare il servizio `nba-studio` e cancellare
   il disco persistente `lab-data` (eventuale backup dati prima, come da `DEPLOY.md`).
7. **Materiale sensibile** (`OLD/*`, zip di backup con PII): tenuto al sicuro, **mai**
   nel repo nuovo.

---

## Testing

- **Import endpoint**: dataset valido → 200 + conteggi corretti + file scritto in
  DATA_DIR + cache azzerata (lista popolata). Dataset non valido → 400, file
  preesistente immutato. Senza permessi admin → 401/403.
- **App vuota**: avvio senza `dataset.json` → nessun errore, 0 clienti/lead, Check-up
  demo presenti.
- **Build exe**: lo spec senza la riga dataset produce un exe che parte vuoto.
- **Privacy**: `git ls-files | grep dataset.json` → nessun risultato nel repo nuovo.

## Rischi

- GitHub può trattenere blob/cache anche dopo la cancellazione del repo: il dato va
  comunque trattato come "già esposto" e gestito secondo le procedure GDPR di Tangible.
- Riscrivere/cambiare repo richiede ai membri del team di ri-clonare.
