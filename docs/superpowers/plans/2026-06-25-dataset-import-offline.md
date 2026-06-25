# Dataset fuori da git + import locale — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che il dataset reale (PII) non stia mai nel repo né nell'exe; l'app parte vuota e un admin importa il dataset.json in locale dalla UI.

**Architecture:** `dataset.json` esce da git e dal bundle PyInstaller. A runtime il dato vive solo in `%APPDATA%\NBAStudio\dataset.json`. Un endpoint admin riceve il JSON, lo valida, lo scrive su quel path e azzera la cache `nba_api._DATA` (reload a caldo già supportato dal backend). Bonifica finale: bundle storico offline + repo GitHub nuovo pulito.

**Tech Stack:** FastAPI (server.py), JS vanilla (admin.js), PyInstaller (nba_studio.spec), git.

## Global Constraints

- Lavorare **solo** in `tangible_lab/` + config repo (`.gitignore`, CI, docs). Mai modificare i file vendored del cliente (`nba_api.py`, `nba_engine.py`, `nba_config.py`, `nba_catalog.py`, `dataset.json`, `generate_dataset.py`, `trigger_catalog_*.json`, `static/`, `*.spec` del cliente, `build_all.bat`).
- Lingua italiana per UI, commenti, commit.
- **Nessun framework di test nel progetto**: le verifiche si fanno con script Python in-process, `curl`, e `node --check`. Niente pytest.
- L'import sostituisce **integralmente** il dataset (clients + leads).
- Endpoint import protetto da `require_admin`.
- Le azioni distruttive su GitHub/Render (Task 4) le esegue **l'utente**; il piano prepara comandi e checkpoint.

---

### Task 1: Smettere di versionare e spedire il dataset reale

**Files:**
- Modify: `.gitignore`
- Modify: `tangible_lab/nba_studio.spec` (rimozione riga datas del dataset)

**Interfaces:**
- Consumes: niente.
- Produces: stato in cui `dataset.json` non è tracciato da git e non è incluso nel bundle. `nba_api.load_dataset()` con file assente ritorna `{"clients": [], "leads": []}` (comportamento già esistente del backend).

- [ ] **Step 1: Smettere di tracciare dataset.json e ignorarlo**

```bash
cd /Users/luscarpa/Sites/NBA
git rm --cached dataset.json
printf '\n# Dataset reale: contiene PII, non va MAI in git (si importa in locale)\n/dataset.json\n' >> .gitignore
```

- [ ] **Step 2: Verificare che non sia più tracciato né committabile**

Run:
```bash
git ls-files dataset.json        # atteso: nessun output
git check-ignore -v dataset.json # atteso: match su .gitignore (/dataset.json)
```
Expected: prima riga vuota; seconda mostra la regola `/dataset.json`.

- [ ] **Step 3: Rimuovere il dataset dal bundle PyInstaller**

In `tangible_lab/nba_studio.spec`, dentro la lista `datas`, **eliminare** questa riga:
```python
    (os.path.join(_ROOT, "dataset.json"), "."),
```
Lasciare invariate le altre voci (static, tangible_lab/static, tangible_lab/checkup, nba_config.json, trigger_catalog_*).

- [ ] **Step 4: Verificare che l'app parta vuota senza dataset.json**

Run (simula assenza del file usando una DATA_DIR temporanea vuota):
```bash
cd /Users/luscarpa/Sites/NBA
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" .venv/bin/python - <<'PY'
import os, importlib
import nba_api
# Forza un path inesistente come farebbe la prima esecuzione senza import
nba_api.DATASET_PATH = os.path.join(os.environ["TANGIBLE_LAB_DATA_DIR"], "dataset.json")
nba_api._DATA = None
d = nba_api.load_dataset()
print("clients:", len(d["clients"]), "leads:", len(d["leads"]))
assert d == {"clients": [], "leads": []}, d
print("OK: app vuota senza errori")
PY
```
Expected: `clients: 0 leads: 0` + `OK: app vuota senza errori`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore tangible_lab/nba_studio.spec
git commit -m "Dataset fuori da git e dal bundle: l'app parte vuota, niente PII spedite

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Endpoint admin di import dataset

**Files:**
- Modify: `tangible_lab/server.py` (nuovo endpoint, **prima** del mount statico `/lab` ~riga 874)

**Interfaces:**
- Consumes: `require_admin(request)`, `HTTPException`, `Body`, `Request` (già importati in server.py); `nba_api.DATASET_PATH`, `nba_api._DATA` (cache del backend cliente).
- Produces: `POST /lab/admin/dataset/import` → body JSON `{clients:[...], leads:[...]}` → risposta `{"clients": int, "leads": int}`. Errore `400` se struttura non valida.

- [ ] **Step 1: Verificare gli import necessari in cima a server.py**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
grep -nE "^import json|^import os" tangible_lab/server.py
```
Se manca `import json` o `import os`, aggiungerlo nel blocco import in cima al file. (`os` è quasi certamente già presente; `json` va verificato.)

- [ ] **Step 2: Aggiungere l'endpoint**

In `tangible_lab/server.py`, **subito prima** della riga del mount statico
`app.mount("/lab", StaticFiles(...))`, inserire:

```python
@app.post("/lab/admin/dataset/import", include_in_schema=False)
def admin_import_dataset(request: Request, payload: dict = Body(...)):
    """Importa il dataset reale in locale (solo admin). Sostituisce quello corrente.

    Il dato non sta mai nel repo/exe: viene scritto in DATASET_PATH
    (%APPDATA%\\NBAStudio\\dataset.json) e la cache del backend viene azzerata.
    """
    require_admin(request)
    import nba_api as _na

    clients = payload.get("clients")
    leads = payload.get("leads")
    if not isinstance(clients, list) or not isinstance(leads, list):
        raise HTTPException(
            status_code=400,
            detail="Formato non valido: il file deve contenere le liste 'clients' e 'leads'.",
        )

    target = _na.DATASET_PATH
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    tmp = target + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, target)   # scrittura atomica

    _na._DATA = None           # reload a caldo: il prossimo accesso rilegge da disco
    return {"clients": len(clients), "leads": len(leads)}
```

- [ ] **Step 3: Verificare l'import valido (in-process, con admin simulato)**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" TANGIBLE_LAB_DB="$(mktemp -u).db" .venv/bin/python - <<'PY'
import json, nba_api
import tangible_lab.server as s
# bypassa l'auth chiamando la logica con un require_admin neutralizzato
import tangible_lab.auth as auth
auth_orig = s.require_admin
s.require_admin = lambda request: {"id": 1, "role": "admin"}
class Req: pass
data = {"clients": [{"client_id": "C1"}, {"client_id": "C2"}], "leads": [{"lead_id": "L1"}]}
out = s.admin_import_dataset(Req(), payload=data)
print("risposta:", out)
assert out == {"clients": 2, "leads": 1}, out
# il file è stato scritto e la cache rilegge i nuovi dati
nba_api._DATA = None
d = nba_api.load_dataset()
assert len(d["clients"]) == 2 and len(d["leads"]) == 1, d
print("OK: import valido scrive il file e ricarica")
# struttura non valida -> 400
try:
    s.admin_import_dataset(Req(), payload={"clients": "x"})
    print("ERRORE: avrebbe dovuto sollevare 400")
except Exception as e:
    print("OK: struttura non valida rifiutata ->", type(e).__name__)
PY
```
Expected: `risposta: {'clients': 2, 'leads': 1}`, `OK: import valido...`, `OK: struttura non valida rifiutata -> HTTPException`.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/server.py
git commit -m "Import dataset: endpoint admin POST /lab/admin/dataset/import con reload a caldo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: UI di import nel pannello Admin

**Files:**
- Modify: `tangible_lab/static/admin.js` (estende `renderExport()` con una sezione "Importa dataset")

**Interfaces:**
- Consumes: helper esistenti `el()`, `fetchJSON()`, `toast()`; endpoint `POST /lab/admin/dataset/import`.
- Produces: sezione UI nel tab Export con input file `.json` + pulsante Importa.

- [ ] **Step 1: Trovare la fine di renderExport()**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
grep -nE "function renderExport|box.appendChild" tangible_lab/static/admin.js | head
```
Individuare l'ultima `box.appendChild(...)` dentro `renderExport()`.

- [ ] **Step 2: Aggiungere la sezione import in coda a renderExport()**

Subito **prima** della chiusura di `renderExport()` (dopo l'ultimo `box.appendChild`), inserire:

```javascript
    // --- Importa dataset (sostituisce quello corrente) ---
    const dsCard = el("div", {class:"section-block"});
    dsCard.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "database"),
      el("span", {}, "Importa dataset")));
    const dsFile = el("input", {type:"file", accept:".json"});
    const dsBtn = el("button", {class:"btn", onclick: async () => {
      const f = dsFile.files && dsFile.files[0];
      if (!f) { toast("Seleziona un file dataset.json", "err"); return; }
      if (!confirm("L'import SOSTITUISCE il dataset corrente. Procedere?")) return;
      let obj;
      try { obj = JSON.parse(await f.text()); }
      catch { toast("File JSON non valido", "err"); return; }
      try {
        const r = await fetchJSON("/lab/admin/dataset/import", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(obj),
        });
        toast(`Importati ${r.clients} clienti e ${r.leads} lead`, "ok");
      } catch (e) { toast(e.message, "err"); }
    }}, "Importa");
    dsCard.appendChild(el("div", {class:"section-body", style:{display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap"}},
      el("span", {class:"muted"}, "Carica il dataset.json reale (resta solo su questo PC)."),
      dsFile, dsBtn));
    box.appendChild(dsCard);
```

- [ ] **Step 3: Verificare la sintassi JS**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/admin.js && echo "JS OK"
```
Expected: `JS OK`.

- [ ] **Step 4: Verifica manuale end-to-end (facoltativa ma consigliata)**

```bash
cd /Users/luscarpa/Sites/NBA
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" .venv/bin/python tangible_lab/server.py
```
Nel browser: login admin → tab Export → sezione "Importa dataset" → carica un `dataset.json` → verifica il toast con i conteggi e che la lista anagrafiche si popoli. Poi chiudere il server.

- [ ] **Step 5: Commit**

```bash
git add tangible_lab/static/admin.js
git commit -m "Admin UI: sezione Importa dataset (upload JSON locale)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Bonifica PII e repo GitHub nuovo pulito (runbook)

**Files:**
- Nessuna modifica di codice. Operazioni git + checkpoint manuali utente.

**Interfaces:**
- Consumes: lo stato del working tree dopo i Task 1–3 (privo di PII tracciate).
- Produces: bundle storico offline; nuovo repo GitHub pulito; vecchio repo e Render dismessi (a cura utente).

- [ ] **Step 1: Creare il bundle storico (storicizzazione pre-update)**

```bash
cd /Users/luscarpa/Sites/NBA
git bundle create ../nba-archivio-storico-$(git rev-parse --short HEAD).bundle --all
```
Spostare il file `.bundle` in un **luogo sicuro offline** (contiene PII nella history: trattare come materiale sensibile). È l'archivio recuperabile della versione precedente.

- [ ] **Step 2: Creare la history pulita (nuovo ramo orfano)**

```bash
cd /Users/luscarpa/Sites/NBA
git checkout --orphan main-pulito
git add -A
git status   # CONTROLLARE: dataset.json NON deve comparire tra i file in stage
git commit -m "NBA Studio — base pulita (offline, senza dati personali)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Verificare che nessuna PII sia nella nuova history**

Run:
```bash
git ls-files | grep -i dataset.json || echo "OK: nessun dataset.json tracciato"
git log --oneline   # deve esserci UN solo commit (la base pulita)
```
Expected: `OK: nessun dataset.json tracciato` e un solo commit.

- [ ] **Step 4 (UTENTE): Creare il nuovo repo privato su GitHub e collegarlo**

L'utente crea un repository **vuoto e privato** su GitHub (es. `nba-studio`), poi fornisce l'URL. Quindi:
```bash
cd /Users/luscarpa/Sites/NBA
git remote rename origin origin-vecchio
git remote add origin <URL-NUOVO-REPO>
git branch -M main-pulito main
git push -u origin main
```
Reintegrare la CI: la GitHub Action `.github/workflows/build-windows.yml` è già nel working tree e finisce nel primo commit, quindi sarà presente sul nuovo `main`.

- [ ] **Step 5 (UTENTE): Cancellare il vecchio repo e dismettere Render**

Checklist manuale (azioni distruttive, eseguite dall'utente):
- GitHub → repo vecchio `luscarpa-pro/nba` → Settings → **Delete repository**. (Valutare richiesta a GitHub Support per le cache se richiesto dalle procedure GDPR.)
- Render → servizio `nba-studio` → eventuale backup dati (vedi `tangible_lab/DEPLOY.md`) → **Suspend/Delete** → cancellare il disco persistente `lab-data`.

- [ ] **Step 6: Aggiornare la documentazione**

In `tangible_lab/DISTRIBUZIONE_WINDOWS.md`, sezione "Dove finiscono i dati", aggiungere una nota:
> Il dataset reale NON è incluso nell'exe: all'avvio l'app è vuota. Importa il `dataset.json` da **Admin → Export → Importa dataset**; resta solo in `%APPDATA%\NBAStudio`.

Poi:
```bash
git add tangible_lab/DISTRIBUZIONE_WINDOWS.md
git commit -m "Docs: import del dataset in locale (app vuota di fabbrica)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

## Self-Review

**Spec coverage:**
- Dataset fuori da git → Task 1. Fuori dal bundle → Task 1 (step 3). App vuota di fabbrica → Task 1 (step 4). Check-up demo restano → invariati (file separati, non toccati). Import admin via UI (body JSON) → Task 2 + Task 3. Sostituzione integrale → Task 2. Reload a caldo → Task 2. Runbook (bundle, repo pulito, cancellazione, Render) → Task 4. Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; codice completo in ogni step; comandi con output atteso. `<URL-NUOVO-REPO>` è un valore che solo l'utente può fornire (repo ancora inesistente) → marcato come step UTENTE.

**Type consistency:** endpoint ritorna `{"clients": int, "leads": int}`; la UI legge `r.clients`/`r.leads`; coerente. `nba_api._DATA`/`DATASET_PATH` usati come nel backend esistente.
