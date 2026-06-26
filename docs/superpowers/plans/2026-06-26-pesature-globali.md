# Pesature globali — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare le pesature dal per-record a un pannello globale nello Studio che modifica la config e la applica a tutte le anagrafiche (con persistenza, re-score e ripristino default).

**Architecture:** Si riusa l'editor esistente (`cmpModeBtn` + `renderCmpEditor` + stato `cmp*` + `buildCmpConfig`) in un nuovo pannello/overlay globale aperto da un link header. "Applica a tutti" fa `PUT /config` (persiste + reload motore) e ricarica la lista; "Ripristina default" chiama un nuovo endpoint che re-seeda la config. Il tab per-record "Confronta pesature" viene rimosso e l'editor disaccoppiato dal record selezionato (default client).

**Tech Stack:** FastAPI (server.py), JS vanilla (studio.js), CSS (studio.css).

## Global Constraints

- Solo `tangible_lab/` (server.py + static/). Mai i file vendored del cliente.
- L'editor globale edita i **pesi client**; `lead_weights` resta invariato (preservato da `buildCmpConfig`, che parte da deepClone della config completa).
- Lingua italiana. Riuso helper esistenti: `el`, `fetchJSON`, `toast`, `cmpModeBtn`, `renderCmpEditor`, `buildCmpConfig`, `initCmpFromConfig`, `buildItems`, `updateFolderCounts`, `renderListPane`.
- Niente framework di test: verifiche con script in-process, `node --check`, boot reale / Playwright.
- Commit message in italiano, terminare con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Endpoint backend "ripristina default config"

**Files:**
- Modify: `tangible_lab/server.py` (nuovo endpoint, prima del mount statico `/lab`)

**Interfaces:**
- Consumes: `_REPO_ROOT`, `os`, `shutil`, `HTTPException`, `Request`, `require_admin` (già in server.py).
- Produces: `POST /lab/admin/config/reset` → `{"status":"ok"}`; ripristina `nba_config.json` di default e ricarica il motore.

- [ ] **Step 1: Aggiungere l'endpoint**

In `tangible_lab/server.py`, subito **prima** di `app.mount("/lab", StaticFiles(...))`, inserire:

```python
@app.post("/lab/admin/config/reset", include_in_schema=False)
def admin_config_reset(request: Request):
    """Ripristina la config di default del cliente (re-seed) e ricarica il motore."""
    require_admin(request)
    import nba_config as _nc
    src = os.path.join(_REPO_ROOT, "nba_config.json")
    if not os.path.exists(src):
        raise HTTPException(status_code=500, detail="Config di default non trovata")
    shutil.copy2(src, _nc.CONFIG_JSON_PATH)
    _nc.reload_config()
    return {"status": "ok"}
```

- [ ] **Step 2: Verifica in-process**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" TANGIBLE_LAB_DB="$(mktemp -u).db" TANGIBLE_LAB_SINGLE_USER=1 .venv/bin/python - <<'PY' 2>&1 | tail -6
import json, nba_config
import tangible_lab.server as s
s.require_admin = lambda request: {"id":1,"role":"admin"}
class Req: cookies = {}
# sporco la config seedata
p = nba_config.CONFIG_JSON_PATH
d = json.load(open(p)); d["client_weights"]["urgency"]["value"] = 0.99
json.dump(d, open(p,"w"))
# reset
out = s.admin_config_reset(Req()); print("reset:", out)
import nba_config as nc; nc.reload_config()
val = json.load(open(p))["client_weights"]["urgency"]["value"]
print("urgency dopo reset:", val)
assert abs(val - 0.99) > 1e-9, "config NON ripristinata"
print("OK: config ripristinata al default")
PY
```
Expected: `reset: {'status': 'ok'}` e `OK: config ripristinata al default`.

- [ ] **Step 3: Commit**

```bash
git add tangible_lab/server.py
git commit -m "Config: endpoint POST /lab/admin/config/reset (ripristina default + reload)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rimuovere il tab per-record + disaccoppiare l'editor (client)

**Files:**
- Modify: `tangible_lab/static/studio.js`

**Interfaces:**
- Consumes: niente.
- Produces: dettaglio anagrafica senza tab "Confronta pesature"; `initCmpFromConfig`/`buildCmpConfig` operano su tipo "client" fisso (usati solo dal pannello globale).

- [ ] **Step 1: Rimuovere il bottone tab "compare" dalla tabsBar**

In `tangible_lab/static/studio.js` sostituire:
```javascript
      el("button", {class:"dtab", "data-tab":"profile", onclick:()=>switchDetailTab("profile")},
        el("span", {class:"msi"}, "badge"), " Profilo"),
      el("button", {class:"dtab", "data-tab":"compare", onclick:()=>switchDetailTab("compare")},
        el("span", {class:"msi"}, "tune"), " Confronta pesature")
    );
```
con:
```javascript
      el("button", {class:"dtab", "data-tab":"profile", onclick:()=>switchDetailTab("profile")},
        el("span", {class:"msi"}, "badge"), " Profilo")
    );
```

- [ ] **Step 2: Rimuovere il pane "compare"**

Eliminare le righe:
```javascript
    // ---- Compare tab pane ----
    const comparePane = el("div", {class:"tab-pane", "data-tab":"compare"});
    comparePane.appendChild(buildComparePane());
    body.appendChild(comparePane);
```

- [ ] **Step 3: Togliere "compare" dai tab validi e la init per-record**

- Sostituire `const valid = ["nba","profile","compare"];` con `const valid = ["nba","profile"];`
- In `loadAnagrafica`, eliminare la riga `    initCmpFromConfig();` (l'editor ora si inizializza solo all'apertura del pannello globale).

- [ ] **Step 4: Disaccoppiare initCmpFromConfig dal record (tipo client)**

In `initCmpFromConfig` sostituire:
```javascript
    const wkey = STATE.selected?.type === "lead" ? "lead_weights" : "client_weights";
    const w = cfg[wkey] || {};
    STATE.cmpWeights = {};
    weightFactorsFor(STATE.selected?.type).forEach(f => {
      STATE.cmpWeights[f.k] = getV(w[f.k]) ?? (1 / weightFactorsFor(STATE.selected?.type).length);
    });
```
con:
```javascript
    const w = cfg["client_weights"] || {};
    STATE.cmpWeights = {};
    weightFactorsFor("client").forEach(f => {
      STATE.cmpWeights[f.k] = getV(w[f.k]) ?? (1 / weightFactorsFor("client").length);
    });
```

- [ ] **Step 5: Disaccoppiare buildCmpConfig dal record (tipo client)**

In `buildCmpConfig` sostituire `const type = STATE.selected?.type || "client";` con `const type = "client";`.

- [ ] **Step 6: Verifica sintassi + assenza tab**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "JS OK"
grep -c 'data-tab="compare"' tangible_lab/static/studio.js
```
Expected: `JS OK` e conteggio `0`.

- [ ] **Step 7: Commit**

```bash
git add tangible_lab/static/studio.js
git commit -m "Rimosso il tab per-record 'Confronta pesature' + editor cmp disaccoppiato (client)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pannello "Pesature" globale

**Files:**
- Modify: `tangible_lab/static/studio.js` (funzioni pannello + link header)
- Modify: `tangible_lab/static/studio.css` (stili overlay)

**Interfaces:**
- Consumes: `cmpModeBtn`, `renderCmpEditor`, `buildCmpConfig`, `initCmpFromConfig`, `fetchJSON`, `toast`, `buildItems`, `updateFolderCounts`, `renderListPane`; endpoint `PUT /config` e `POST /lab/admin/config/reset`.
- Produces: `openWeightsPanel()`; link header "Pesature".

- [ ] **Step 1: Aggiungere le funzioni del pannello (prima di `function renderDetail(it) {`)**

In `tangible_lab/static/studio.js`, prima di `function renderDetail(it) {`, inserire:

```javascript
  // ============================== Pannello Pesature globali ==============================
  async function reloadAfterConfig() {
    const [clients, leads, cfg] = await Promise.all([
      fetchJSON("/nba/clients?n=10000"),
      fetchJSON("/nba/leads?n=10000"),
      fetchJSON("/config")
    ]);
    STATE.clients = clients || []; STATE.leads = leads || []; STATE.config = cfg;
    STATE.items = buildItems(); updateFolderCounts(); renderListPane();
  }
  function buildWeightsOverlay() {
    if (document.getElementById("wts-overlay")) return;
    const panel = el("div", {class:"wts-panel", id:"wts-panel", role:"dialog", "aria-label":"Pesature"});
    const overlay = el("div", {id:"wts-overlay", class:"wts-overlay"}, panel);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeWeightsPanel(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.classList.contains("open")) closeWeightsPanel(); });
    document.body.appendChild(overlay);
  }
  function closeWeightsPanel() { const o = document.getElementById("wts-overlay"); if (o) o.classList.remove("open"); }
  function openWeightsPanel() {
    initCmpFromConfig();
    buildWeightsOverlay();
    renderWeightsPanel();
    document.getElementById("wts-overlay").classList.add("open");
  }
  function renderWeightsPanel() {
    const panel = document.getElementById("wts-panel");
    panel.innerHTML = "";
    panel.appendChild(el("div", {class:"wts-head"},
      el("h2", {}, el("span", {class:"msi"}, "tune"), " Pesature globali"),
      el("p", {class:"muted", style:{margin:"4px 0 0", fontSize:"12px"}}, "Modifica la ricetta del punteggio e applicala a tutte le anagrafiche.")));
    panel.appendChild(el("div", {class:"cmp-mode-tabs"},
      cmpModeBtn("weights",  "tune",               "Pesi"),
      cmpModeBtn("tiers",    "stacked_bar_chart",  "Soglie priorità"),
      cmpModeBtn("churn",    "trending_down",      "Rischio churn"),
      cmpModeBtn("leadthr",  "crisis_alert",       "Soglie lead"),
      cmpModeBtn("boosts",   "north",              "Boost trigger"),
      cmpModeBtn("premiums", "euro",               "Premi medi"),
      cmpModeBtn("json",     "code",               "JSON")));
    const editor = el("div", {id:"cmp-editor", class:"wts-body"});
    panel.appendChild(editor);
    renderCmpEditor(editor);
    const applyBtn = el("button", {class:"btn primary-cta", type:"button"}, el("span", {class:"msi"}, "done_all"), " Applica a tutti");
    applyBtn.addEventListener("click", async () => {
      const cfg = buildCmpConfig();
      if (!cfg) { toast("Configurazione non valida", "err"); return; }
      applyBtn.disabled = true;
      try {
        await fetchJSON("/config", {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(cfg)});
        await reloadAfterConfig();
        toast("Pesature applicate a tutte le anagrafiche", "ok");
        closeWeightsPanel();
      } catch (e) { toast(e.message, "err"); }
      finally { applyBtn.disabled = false; }
    });
    const resetBtn = el("button", {class:"btn ghost", type:"button"}, el("span", {class:"msi"}, "restart_alt"), " Ripristina default");
    resetBtn.addEventListener("click", async () => {
      if (!confirm("Ripristinare le pesature originali Vittoria? Le modifiche applicate verranno perse.")) return;
      resetBtn.disabled = true;
      try {
        await fetchJSON("/lab/admin/config/reset", {method:"POST"});
        await reloadAfterConfig();
        initCmpFromConfig(); renderWeightsPanel();
        toast("Pesature ripristinate ai valori di default", "ok");
      } catch (e) { toast(e.message, "err"); }
      finally { resetBtn.disabled = false; }
    });
    panel.appendChild(el("div", {class:"wts-foot"},
      el("button", {class:"btn ghost", type:"button", onclick: closeWeightsPanel}, "Chiudi"),
      el("div", {class:"wts-foot-right"}, resetBtn, applyBtn)));
  }

```

- [ ] **Step 2: Aggiungere il link "Pesature" nell'header**

In `tangible_lab/static/studio.js`, nel blocco header (dopo le chiamate `addLink(...)`), inserire:

```javascript
      const wbtn = document.createElement("button");
      wbtn.className = "home-link"; wbtn.type = "button";
      wbtn.title = "Pesature — pesi e soglie del motore (globali)";
      wbtn.innerHTML = '<span class="msi">tune</span><span class="home-link-lbl">Pesature</span>';
      wbtn.addEventListener("click", () => openWeightsPanel());
      headerActions.insertBefore(wbtn, headerActions.children[0]);
```

- [ ] **Step 3: Stili overlay (in coda a studio.css)**

```css
/* ============ Pannello Pesature globali ============ */
.wts-overlay{display:none;position:fixed;inset:0;background:rgba(15,17,32,.5);backdrop-filter:blur(2px);z-index:1100;align-items:center;justify-content:center;padding:16px}
.wts-overlay.open{display:flex}
.wts-panel{background:#fff;border-radius:14px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 16px 50px rgba(15,17,32,.25);overflow:hidden}
.wts-head{padding:18px 22px 10px;border-bottom:1px solid var(--border-soft)}
.wts-head h2{margin:0;font-size:18px;color:var(--ink);display:flex;align-items:center;gap:8px}
.wts-head .msi{color:var(--primary)}
.wts-body{padding:14px 22px;overflow:auto;flex:1}
.wts-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--border-soft)}
.wts-foot-right{display:flex;gap:8px}
```

- [ ] **Step 4: Verifica sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "JS OK"
```
Expected: `JS OK`.

- [ ] **Step 5: Verifica funzionale (Playwright, fatta dal controllore)**

Aprire `/lab/`, cliccare "Pesature" nell'header → si apre il pannello con le mode tabs e gli slider; cambiare un peso → "Applica a tutti" → toast + la distribuzione tier della lista cambia (e persiste a reload). "Ripristina default" riporta i valori originali.

- [ ] **Step 6: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "Pesature: pannello globale (Applica a tutti via PUT /config + Ripristina default)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Link header "Pesature" → Task 3 Step 2. Pannello globale che riusa l'editor → Task 3 Step 1. Applica a tutti (PUT /config + reload) → Task 3 (`applyBtn`/`reloadAfterConfig`). Ripristina default → Task 1 (endpoint) + Task 3 (`resetBtn`). Rimozione tab per-record + breakdown che resta → Task 2 (rimuove solo il tab compare; il result-box/breakdown è invariato). Decoupling editor client → Task 2 Step 4-5. Backend reset → Task 1. Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; codice completo; comandi con output atteso.

**Type consistency:** `openWeightsPanel`/`renderWeightsPanel`/`closeWeightsPanel`/`buildWeightsOverlay`/`reloadAfterConfig` coerenti tra definizione (Task 3 Step 1) e uso (Step 2 link header). `cmpModeBtn`/`renderCmpEditor`/`buildCmpConfig`/`initCmpFromConfig` riusati con firma esistente; `#cmp-editor` (id) coerente con ciò che `cmpModeBtn` ri-renderizza. Endpoint `/lab/admin/config/reset` prodotto in Task 1 e consumato in Task 3.
