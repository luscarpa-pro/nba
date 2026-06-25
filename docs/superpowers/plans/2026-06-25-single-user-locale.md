# Modalità single-user locale — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In modalità locale (flag `TANGIBLE_LAB_SINGLE_USER`) l'app si apre senza login, senza ruoli/condivisione, con un pannello "Strumenti"; rimossa l'infrastruttura Render.

**Architecture:** Si cambia il comportamento al confine auth (`user_from_request` ritorna l'utente locale admin col flag attivo) e si semplifica la UI; lo schema dati resta invariato. Col flag spento il comportamento è identico a oggi.

**Tech Stack:** FastAPI (auth.py/server.py), JS vanilla (studio.js/admin.js + index.html/admin.html), git.

## Global Constraints

- Lavorare in `tangible_lab/` + config repo. MAI modificare i file vendored del cliente (`nba_api.py`, `nba_engine.py`, `nba_config.py`, `nba_catalog.py`, `dataset.json`, `generate_dataset.py`, `trigger_catalog_*.json`, `static/` di root).
- Lingua italiana per UI/commenti/commit.
- Nessun framework di test: verifiche via script Python in-process, `node --check`, boot reale. Niente pytest.
- Lo schema DB (`users`/`sessions`/`role`/`owner_id`/`shared`) NON va modificato.
- Col flag `TANGIBLE_LAB_SINGLE_USER` spento il comportamento deve restare quello attuale (auth completa).
- Commit message terminano con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Bypass auth single-user (backend)

**Files:**
- Modify: `tangible_lab/auth.py` (inizio di `user_from_request`, ~riga 81)
- Modify: `tangible_lab/desktop_main.py` (in `main()`, dopo il set di `TANGIBLE_LAB_DATA_DIR`)

**Interfaces:**
- Consumes: `get_conn` (già importato in auth.py), `os` (già importato).
- Produces: con `TANGIBLE_LAB_SINGLE_USER` attivo, `user_from_request(request)` ritorna l'utente admin locale `{"id","username","role","must_change_password": False}` ignorando il cookie; quindi `require_user`/`require_admin`/`/lab/api/me` funzionano senza login.

- [ ] **Step 1: Impostare il flag nell'entry-point desktop**

In `tangible_lab/desktop_main.py`, dentro `main()`, subito dopo la riga
`os.environ.setdefault("TANGIBLE_LAB_DATA_DIR", _default_data_dir())`, aggiungere:

```python
    # Modalità locale: un solo utente, niente login (vedi auth.user_from_request)
    os.environ.setdefault("TANGIBLE_LAB_SINGLE_USER", "1")
```

- [ ] **Step 2: Aggiungere il bypass in user_from_request**

In `tangible_lab/auth.py`, come **prime righe del corpo** di `def user_from_request(request: Request) -> Optional[dict]:` (prima di `signed = request.cookies.get(...)`), inserire:

```python
    # Modalità single-user locale: nessun login, ritorna l'utente admin locale.
    if os.environ.get("TANGIBLE_LAB_SINGLE_USER"):
        with get_conn() as conn:
            row = conn.execute(
                "SELECT id, username, role FROM users WHERE active = 1 AND role = 'admin' ORDER BY id LIMIT 1"
            ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "must_change_password": False,
        }
```

- [ ] **Step 3: Verificare bypass attivo e flag spento (in-process)**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
# flag ATTIVO: ritorna l'admin locale senza cookie
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" TANGIBLE_LAB_DB="$(mktemp -u).db" TANGIBLE_LAB_SINGLE_USER=1 .venv/bin/python - <<'PY'
import tangible_lab.server  # boot: init_db + bootstrap admin
from tangible_lab import auth
class Req: cookies = {}
u = auth.user_from_request(Req())
print("single-user:", u)
assert u and u["role"] == "admin" and u["must_change_password"] is False, u
print("require_admin:", auth.require_admin(Req())["username"])
print("OK flag attivo")
PY
# flag SPENTO: senza cookie ritorna None (comportamento attuale)
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" TANGIBLE_LAB_DB="$(mktemp -u).db" .venv/bin/python - <<'PY'
import tangible_lab.server
from tangible_lab import auth
class Req: cookies = {}
assert auth.user_from_request(Req()) is None
print("OK flag spento: None")
PY
```
Expected: `single-user: {...role: 'admin'...}`, `require_admin: admin`, `OK flag attivo`, poi `OK flag spento: None`.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/auth.py tangible_lab/desktop_main.py
git commit -m "Single-user: bypass login via flag TANGIBLE_LAB_SINGLE_USER (utente admin locale)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Semplificazione UI Studio

**Files:**
- Modify: `tangible_lab/static/index.html` (righe 53-54, folder sidebar)
- Modify: `tangible_lab/static/studio.js` (menu utente, toggle salvataggio, commenti)

**Interfaces:**
- Consumes: niente dai task precedenti.
- Produces: UI senza login/ruolo/logout/condivisione; folder unico "Casi salvati"; commenti etichettati "Note".

- [ ] **Step 1: Sidebar — unico folder "Casi salvati"**

In `tangible_lab/static/index.html`:
- Riga 53: sostituire `title="I miei salvati"` con `title="Casi salvati"` e `<span class="lbl">Miei</span>` con `<span class="lbl">Casi salvati</span>`.
- Riga 54 (`<li data-folder="shared" ...>...Condivisi...</li>`): **eliminare l'intera riga**.

- [ ] **Step 2: Menu utente — togliere ruolo, cambio password, logout; rinominare Admin→Strumenti**

In `tangible_lab/static/studio.js`:
- Eliminare la riga del ruolo:
  `<div class="umh-role">${STATE.me.role === "admin" ? "Amministratore" : "Tester"}</div>`
- Eliminare il bottone "Cambia password" (blocco `<button class="user-menu-item" id="menu-change-pw"> ... Cambia password </button>`) e la sua riga listener `wrap.querySelector("#menu-change-pw").addEventListener(...)`.
- Eliminare il bottone logout (`<button class="user-menu-item danger" id="menu-logout"> ... Esci </button>`) e il suo listener:
  ```javascript
        wrap.querySelector("#menu-logout").addEventListener("click", async () => {
          await fetch("/lab/api/logout", {method:"POST", credentials:"include"});
          location.href = "/lab/login.html";
        });
  ```
- Nel link Admin, rinominare in Strumenti: cambiare `title="Pannello admin"` in `title="Strumenti"`, l'icona `admin_panel_settings` in `build`, e l'etichetta `Admin` in `Strumenti`.
- Eliminare il blocco must-change-password:
  ```javascript
      if (STATE.me.must_change_password) {
        setTimeout(() => openChangePasswordModal(true), 300);
      }
  ```

- [ ] **Step 3: Salvataggio caso — sempre privato**

In `tangible_lab/static/studio.js`, nella funzione di salvataggio, sostituire le due righe:
```javascript
    const sharedDefault = existing ? existing.shared : false;
    const shared = confirm("Vuoi condividere questo caso con il team?\n\nOK = sì, condividi · Annulla = privato" + (sharedDefault ? "\n\n(Attualmente: condiviso)" : ""));
```
con:
```javascript
    const shared = false;  // single-user: i casi sono sempre privati
```
E nel toast di conferma sostituire:
```javascript
        toast(`Caso "${name}" salvato${shared ? " e condiviso" : ""}`, "ok");
```
con:
```javascript
        toast(`Caso "${name}" salvato`, "ok");
```

- [ ] **Step 4: Commenti → "Note"**

In `tangible_lab/static/studio.js`, sostituire le tre occorrenze di `Conversazione del team` con `Note`:
- `el("span", {class:"comments-trigger-lbl"}, "Conversazione del team"),` → `"Note"`
- `"aria-label":"Conversazione del team"` → `"aria-label":"Note"`
- `" Conversazione del team"` → `" Note"`

- [ ] **Step 5: Verificare sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "studio.js OK"
```
Expected: `studio.js OK`. (`index.html` è markup, niente check.)

- [ ] **Step 6: Commit**

```bash
git add tangible_lab/static/index.html tangible_lab/static/studio.js
git commit -m "Studio single-user: via login/ruolo/logout/condivisione, commenti -> Note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pannello "Strumenti" (ex Admin)

**Files:**
- Modify: `tangible_lab/static/admin.html` (titolo, tab, sezioni, header logout)
- Modify: `tangible_lab/static/admin.js` (init, switchTab, renderExport + reseed)

**Interfaces:**
- Consumes: helper `el`, `fetchJSON`, `toast` di admin.js; endpoint esistenti `/lab/admin/export/state.xlsx`, `/lab/admin/checkup/reseed`, `/lab/admin/dataset/import`.
- Produces: una sola vista "Strumenti" con Import dataset, Export Excel, Reseed Check-up.

- [ ] **Step 1: admin.html — titolo, tab unica, sezioni**

In `tangible_lab/static/admin.html`:
- `<title>NBA Studio — Admin</title>` → `<title>NBA Studio — Strumenti</title>` e `<h1>NBA Studio — Admin</h1>` → `<h1>NBA Studio — Strumenti</h1>`.
- Nel blocco `<div class="admin-tabs" id="admin-tabs">`, **eliminare** i bottoni `data-tab="dashboard"`, `data-tab="users"`, `data-tab="cases"`, `data-tab="reviews"`. Lasciare solo il bottone export, rietichettandolo: `<button class="active" data-tab="export"><span class="msi">build</span> Strumenti</button>`.
- **Eliminare** le sezioni `<section id="tab-dashboard">`, `<section id="tab-users">`, `<section id="tab-cases">`, `<section id="tab-reviews">`. Lasciare solo `<section id="tab-export">`.
- Trovare nell'header il bottone con `id="logout-btn"` ed **eliminarlo** (in locale non c'è logout).

- [ ] **Step 2: admin.js — init e switchTab semplificati**

In `tangible_lab/static/admin.js`:
- In `init()`: eliminare il blocco del logout:
  ```javascript
      $("#logout-btn").addEventListener("click", async () => {
        await fetch("/lab/api/logout", {method:"POST", credentials:"include"});
        location.href = "/lab/login.html";
      });
  ```
  sostituire `$("#me-name").textContent = STATE.me.username + " · admin";` con `$("#me-name").textContent = STATE.me.username;`
  e cambiare `switchTab("dashboard");` in `switchTab("export");`
- Sostituire l'intera `switchTab` con:
  ```javascript
    function switchTab(t) {
      $$('.admin-tabs button').forEach(b => b.classList.toggle("active", b.dataset.tab === t));
      $("#tab-export").classList.remove("hide");
      renderExport();
    }
  ```

- [ ] **Step 3: admin.js — spostare il reseed Check-up dentro renderExport**

In `renderExport()`, prima di `card.appendChild(body); box.appendChild(card);` (cioè aggiungendo una seconda card alla vista), inserire la card del reseed:

```javascript
    // --- Reseed scenari Check-up ---
    const tools = el("div", {class:"section-block"});
    tools.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "health_and_safety"),
      el("h3", {}, "Scenari Check-up")
    ));
    const seedBtn = el("button", {class:"btn", onclick: async () => {
      seedBtn.disabled = true;
      try {
        const r = await fetchJSON("/lab/admin/checkup/reseed", {method:"POST"});
        toast(`Scenari Check-up: ${r.created} creati, ${r.skipped} già presenti`, "ok");
      } catch (e) { toast(e.message, "err"); }
      finally { seedBtn.disabled = false; }
    }}, el("span", {class:"msi"}, "health_and_safety"), " Carica scenari demo Check-up");
    tools.appendChild(el("div", {class:"section-body"},
      el("div", {class:"muted", style:{fontSize:"12px",marginBottom:"10px"}},
        "Popola il Check-up con 10 scenari demo. Idempotente: salta quelli già presenti."),
      seedBtn
    ));
    box.appendChild(tools);
```

(Le funzioni `renderDashboard`/`renderUsers`/`renderCases`/`renderReviews` restano definite ma non più richiamate: nessuna rimozione, YAGNI.)

- [ ] **Step 4: Verificare sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/admin.js && echo "admin.js OK"
```
Expected: `admin.js OK`.

- [ ] **Step 5: Commit**

```bash
git add tangible_lab/static/admin.html tangible_lab/static/admin.js
git commit -m "Strumenti: ex pannello Admin ridotto a import/export/reseed (no utenti/stats)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rimozione infrastruttura Render

**Files:**
- Delete: `render.yaml`, `Dockerfile`, `tangible_lab/DEPLOY.md`
- Modify: `requirements.txt` (rimuovere `gunicorn`)

**Interfaces:**
- Consumes/Produces: niente (cleanup).

- [ ] **Step 1: Eliminare i file di deploy online**

```bash
cd /Users/luscarpa/Sites/NBA
git rm render.yaml Dockerfile tangible_lab/DEPLOY.md
```

- [ ] **Step 2: Rimuovere gunicorn da requirements.txt**

In `requirements.txt`, eliminare la riga `gunicorn>=21.2`.

- [ ] **Step 3: Verificare**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
ls render.yaml Dockerfile tangible_lab/DEPLOY.md 2>&1 | grep -c "No such file" | grep -q 3 && echo "OK: file rimossi"
grep -q gunicorn requirements.txt && echo "⚠️ gunicorn ancora presente" || echo "OK: gunicorn rimosso"
.venv/bin/python -c "import tangible_lab.server; print('OK: app importa ancora')"
```
Expected: `OK: file rimossi`, `OK: gunicorn rimosso`, `OK: app importa ancora`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Rimozione infrastruttura Render (deploy online dismesso)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Accesso senza login (utente locale admin) → Task 1. UI senza ruolo/logout/condivisione → Task 2. Folder unico → Task 2 (step 1). Commenti → Note → Task 2 (step 4). Pannello Strumenti con import/export/reseed, via utenti/stats/casi → Task 3. Rimozione Render → Task 4. Schema invariato + flag reversibile → Task 1 (nessuna modifica schema; flag). Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; ogni step ha codice/anchor esatti e comandi con output atteso. I pochi "trovare per id" (es. `#logout-btn` in admin.html) sono istruzioni concrete su elementi identificati.

**Type consistency:** il flag `TANGIBLE_LAB_SINGLE_USER` è coerente tra desktop_main (set) e auth (read); l'utente locale ha sempre `role="admin"` così `require_admin` passa; `switchTab` riscritto chiama solo `renderExport` coerente con l'unica sezione `#tab-export` rimasta.
