# Wizard creazione anagrafica + riordino header — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la creazione anagrafica con un wizard scenario-builder a step, e ripulire l'header (via user-chip e link Tutorial; "Strumenti" → "Dati").

**Architecture:** Solo frontend. Il wizard è un overlay a step che riusa i renderer di campo esistenti (`renderField`, `renderArraySection`) su un record di lavoro (`emptyRecord`), e al termine apre il dettaglio ed esegue l'NBA. L'header viene sfoltito in `studio.js`; la pagina Strumenti è rinominata "Dati".

**Tech Stack:** JS vanilla (`studio.js`, `admin.js`), CSS (`studio.css`), HTML (`index.html`, `admin.html`).

## Global Constraints

- Solo `tangible_lab/static/`. Nessun backend/motore. Nessun nuovo endpoint.
- Lingua italiana per UI/commenti/commit.
- Riuso obbligatorio dei renderer esistenti: `renderField(f, data)` (riga ~299) e `renderArraySection(sec, data)` (riga ~411). Helper esistenti: `el(tag, props, ...children)`, `fetchJSON`, `emptyRecord(type)`, `SCHEMAS`, `TRIG_LABELS`, `runNBA()`, `renderDetail(it)`, `renderListPane()`.
- Nessun framework di test: verifica con `node --check` + boot reale / Playwright.
- Commit message in italiano, terminare con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Header — pulizia minima

**Files:**
- Modify: `tangible_lab/static/studio.js` (blocco header in `init`, ~righe 2250-2313)

**Interfaces:**
- Consumes: `STATE.me`, `showTutorial()` (esistente).
- Produces: header con soli link Check-up, Guida, "Dati"; gestione `?tutorial=1`.

- [ ] **Step 1: Sostituire il blocco header**

In `tangible_lab/static/studio.js`, sostituire INTERAMENTE il blocco che inizia con
`const headerActions = document.querySelector("header.studio .actions");` e l'`if (headerActions && !document.querySelector(".user-chip-wrap")) { ... }` (fino alla sua `}` di chiusura, prima di `bindAll();`) con:

```javascript
    // Header: solo link essenziali (single-user: niente user-chip, niente link Tutorial)
    const headerActions = document.querySelector("header.studio .actions");
    if (headerActions && !headerActions.dataset.built) {
      headerActions.dataset.built = "1";
      const addLink = (href, icon, label, title) => {
        const a = document.createElement("a");
        a.className = "home-link"; a.href = href; a.title = title || label;
        a.innerHTML = `<span class="msi">${icon}</span><span class="home-link-lbl">${label}</span>`;
        headerActions.insertBefore(a, headerActions.children[0]);
        return a;
      };
      addLink("/lab/admin.html", "database", "Dati", "Dati — importa/esporta");
      addLink("/lab/guida.html", "menu_book", "Guida", "Guida — come funziona l'algoritmo NBA");
      addLink("/lab/checkup.html", "health_and_safety", "Check-up", "Check-up Vittoria — simulatore bisogni");
    }
    // Riapertura tutorial da link esterno (?tutorial=1), poi pulisce l'URL
    if (new URLSearchParams(location.search).get("tutorial") === "1") {
      showTutorial();
      history.replaceState(null, "", location.pathname);
    }
```

- [ ] **Step 2: Verificare sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "studio.js OK"
```
Expected: `studio.js OK`.

- [ ] **Step 3: Commit**

```bash
git add tangible_lab/static/studio.js
git commit -m "Header: rimossi user-chip e link Tutorial; resta Check-up/Guida/Dati (+?tutorial=1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pagina "Dati" (ex Strumenti)

**Files:**
- Modify: `tangible_lab/static/admin.html` (titolo + heading)
- Modify: `tangible_lab/static/admin.js` (aggiunta due link in `renderExport`)

**Interfaces:**
- Consumes: helper `el` di admin.js.
- Produces: pagina "Dati" con i link "Tool originale Vittoria" e "Rivedi tutorial".

- [ ] **Step 1: Rinominare in admin.html**

In `tangible_lab/static/admin.html`: sostituire `NBA Studio — Strumenti` con `NBA Studio — Dati` nel `<title>` e nell'`<h1>`.

- [ ] **Step 2: Aggiungere i due link in fondo a renderExport (admin.js)**

In `tangible_lab/static/admin.js`, alla fine della funzione `renderExport()` (dopo
`box.appendChild(tools);`, prima della `}` di chiusura), inserire:

```javascript
    // --- Link utili (ex header) ---
    const links = el("div", {class:"section-block"});
    links.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "more_horiz"),
      el("h3", {}, "Altro")));
    links.appendChild(el("div", {class:"section-body", style:{display:"flex", gap:"14px", flexWrap:"wrap"}},
      el("a", {class:"btn ghost", href:"/", title:"UI originale del backend Vittoria (sola lettura)",
        style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"6px"}},
        el("span", {class:"msi"}, "code"), " Tool originale Vittoria"),
      el("a", {class:"btn ghost", href:"/lab/?tutorial=1", title:"Rivedi il tutorial iniziale",
        style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"6px"}},
        el("span", {class:"msi"}, "school"), " Rivedi tutorial")));
    box.appendChild(links);
```

- [ ] **Step 3: Verificare sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/admin.js && echo "admin.js OK"
```
Expected: `admin.js OK`.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/static/admin.html tangible_lab/static/admin.js
git commit -m "Pagina Dati (ex Strumenti): rinomina + link Tool originale e Rivedi tutorial

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wizard creazione anagrafica (scenario-builder)

**Files:**
- Modify: `tangible_lab/static/studio.js` (funzioni wizard + aggancio al pulsante `#ana-new`)
- Modify: `tangible_lab/static/studio.css` (stili overlay wizard)

**Interfaces:**
- Consumes: `el`, `fetchJSON`, `emptyRecord`, `SCHEMAS`, `TRIG_LABELS`, `STATE`, `renderField`, `renderArraySection`, `renderDetail`, `renderListPane`, `runNBA`.
- Produces: `openWizard()` (apre il wizard). Aggancio: il click su `#ana-new` chiama `openWizard()`.

- [ ] **Step 1: Aggiungere le funzioni del wizard (prima di `function renderDetail(it) {`)**

In `tangible_lab/static/studio.js`, immediatamente prima di `function renderDetail(it) {`, inserire:

```javascript
  // ============================== Wizard nuova anagrafica ==============================
  const WIZARD_STEPS = {
    client: [
      { title: "Identità & contatti", keys: ["client_id","email","phone","preferred_channel"] },
      { title: "Polizze", array: "policies" },
      { title: "Pagamenti & relazione", keys: ["unpaid_days","last_contact_days","birthday_days","anniversary_days","checkup_done"] },
      { title: "Scoperture (cross-sell)", keys: ["cross_sell_gaps"] },
      { title: "VIVA & campagne", optional: true, keys: ["viva_enrolled","viva_points","viva_points_expiring"], array: "active_campaigns" },
    ],
    lead: [
      { title: "Dati lead", keys: ["lead_id","product","marketing_consent"] },
      { title: "Timing & preventivo", keys: ["created_hours_ago","last_contact_days","quote_premium","coverage_start_days"] },
    ],
  };
  const WIZ = { type: null, record: null, step: 0 };

  function wizardFieldDef(type, k) {
    for (const sec of SCHEMAS[type].sections) {
      if (sec.fields) { const f = sec.fields.find(x => x.k === k); if (f) return f; }
    }
    return { k, label: k, type: "text" };
  }
  function wizardArraySection(type, arrayKey) {
    return SCHEMAS[type].sections.find(s => s.arrayKey === arrayKey);
  }

  function buildWizardOverlay() {
    if (document.getElementById("wiz-overlay")) return;
    const panel = el("div", {class:"wiz-panel", id:"wiz-panel", role:"dialog", "aria-label":"Nuova anagrafica"});
    const overlay = el("div", {id:"wiz-overlay", class:"wiz-overlay"}, panel);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeWizard(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.classList.contains("open")) closeWizard(); });
    document.body.appendChild(overlay);
  }
  function openWizard() {
    WIZ.type = null; WIZ.record = null; WIZ.step = 0;
    buildWizardOverlay();
    renderWizard();
    document.getElementById("wiz-overlay").classList.add("open");
  }
  function closeWizard() {
    const o = document.getElementById("wiz-overlay"); if (o) o.classList.remove("open");
  }

  function renderWizard() {
    const panel = document.getElementById("wiz-panel");
    panel.innerHTML = "";
    if (!WIZ.type) {
      panel.appendChild(el("div", {class:"wiz-head"}, el("h2", {}, "Nuova anagrafica di test")));
      const pick = (t) => {
        WIZ.type = t; WIZ.record = emptyRecord(t); WIZ.step = 0;
        if (t === "client") WIZ.record.client_id = "C" + String(Date.now()).slice(-6);
        else WIZ.record.lead_id = "L" + String(Date.now()).slice(-6);
        renderWizard();
      };
      panel.appendChild(el("div", {class:"wiz-typecards"},
        el("button", {class:"wiz-typecard", type:"button", onclick:()=>pick("client")}, el("span",{class:"msi"},"person"), el("div",{},"Cliente")),
        el("button", {class:"wiz-typecard", type:"button", onclick:()=>pick("lead")}, el("span",{class:"msi"},"crisis_alert"), el("div",{},"Lead"))));
      panel.appendChild(el("div", {class:"wiz-foot"}, el("button", {class:"btn ghost", type:"button", onclick:closeWizard}, "Annulla")));
      return;
    }
    const steps = WIZARD_STEPS[WIZ.type];
    const total = steps.length + 1;
    const isSummary = WIZ.step >= steps.length;
    panel.appendChild(el("div", {class:"wiz-head"},
      el("h2", {}, isSummary ? "Riepilogo" : steps[WIZ.step].title),
      el("div", {class:"wiz-progress"}, ...Array.from({length: total}, (_, i) => el("span", {class:"wiz-dot" + (i <= WIZ.step ? " on" : "")})))));
    const bodyEl = el("div", {class:"wiz-body"});
    if (!isSummary) {
      const step = steps[WIZ.step];
      (step.keys || []).forEach(k => bodyEl.appendChild(renderField(wizardFieldDef(WIZ.type, k), WIZ.record)));
      if (step.array) {
        if (!Array.isArray(WIZ.record[step.array])) WIZ.record[step.array] = [];
        const sec = wizardArraySection(WIZ.type, step.array);
        if (sec) bodyEl.appendChild(renderArraySection(sec, WIZ.record));
      }
      if (step.optional) bodyEl.appendChild(el("div", {class:"muted", style:{fontSize:"12px",marginTop:"8px"}}, "Step facoltativo — puoi saltarlo."));
    } else {
      bodyEl.appendChild(el("div", {id:"wiz-preview", class:"muted"}, "Calcolo anteprima…"));
      wizardPreview();
    }
    panel.appendChild(bodyEl);
    const foot = el("div", {class:"wiz-foot"});
    foot.appendChild(el("button", {class:"btn ghost", type:"button", onclick:closeWizard}, "Annulla"));
    const right = el("div", {class:"wiz-foot-right"});
    if (WIZ.step > 0 || isSummary) right.appendChild(el("button", {class:"btn ghost", type:"button", onclick:()=>{ WIZ.step--; renderWizard(); }}, "Indietro"));
    if (!isSummary) {
      if (steps[WIZ.step].optional) right.appendChild(el("button", {class:"btn ghost", type:"button", onclick:()=>{ WIZ.step++; renderWizard(); }}, "Salta"));
      right.appendChild(el("button", {class:"btn primary-cta", type:"button", onclick:()=>{ WIZ.step++; renderWizard(); }}, "Avanti"));
    } else {
      right.appendChild(el("button", {class:"btn primary-cta", type:"button", onclick:wizardFinish}, "Crea e testa"));
    }
    foot.appendChild(right);
    panel.appendChild(foot);
  }

  async function wizardPreview() {
    const box = document.getElementById("wiz-preview");
    if (!box) return;
    try {
      const url = WIZ.type === "client" ? "/nba/client/preview?debug=true" : "/nba/lead/preview";
      const body = WIZ.type === "client" ? {client: WIZ.record, config: STATE.config} : {lead: WIZ.record, config: STATE.config};
      const out = await fetchJSON(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      const trigs = (out && out.triggers) || [];
      box.innerHTML = "";
      box.appendChild(el("div", {}, el("strong", {}, "Trigger che si attiveranno:")));
      if (!trigs.length) box.appendChild(el("div", {class:"muted"}, "Nessun trigger — il record potrebbe non generare un'azione."));
      else box.appendChild(el("div", {class:"wiz-trigs"}, ...trigs.map(t => el("span", {class:"gap-chip"}, (TRIG_LABELS[t] && TRIG_LABELS[t].lbl) || t))));
    } catch (e) { box.textContent = "Anteprima non disponibile: " + e.message; }
  }

  function wizardFinish() {
    const type = WIZ.type, rec = WIZ.record;
    closeWizard();
    STATE.selected = { kind:"new", type, id: rec[type === "client" ? "client_id" : "lead_id"] || "(nuovo)" };
    STATE.record = rec;
    STATE.lastResult = null; STATE.lastBreakdown = null; STATE.profileEdit = false;
    document.documentElement.classList.add("has-selection");
    renderListPane();
    renderDetail(STATE.selected);
    runNBA();
  }

```

- [ ] **Step 2: Agganciare il wizard al pulsante "Nuova anagrafica"**

In `tangible_lab/static/studio.js`, sostituire l'handler attuale del pulsante `#ana-new`:

```javascript
    $("#ana-new").addEventListener("click", () => {
      const t = (prompt("Tipo? Scrivi 'client' o 'lead':", "client") || "").trim().toLowerCase();
      if (t !== "client" && t !== "lead") { toast("Tipo non valido", "err"); return; }
      openNewDraft(t);
    });
```
con:
```javascript
    $("#ana-new").addEventListener("click", () => openWizard());
```

- [ ] **Step 3: Aggiungere gli stili wizard (in coda a studio.css)**

In coda a `tangible_lab/static/studio.css`, aggiungere:

```css
/* ============ Wizard nuova anagrafica ============ */
.wiz-overlay{display:none;position:fixed;inset:0;background:rgba(15,17,32,.5);backdrop-filter:blur(2px);z-index:1100;align-items:center;justify-content:center;padding:16px}
.wiz-overlay.open{display:flex}
.wiz-panel{background:#fff;border-radius:14px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 16px 50px rgba(15,17,32,.25);overflow:hidden}
.wiz-head{padding:18px 22px 10px;border-bottom:1px solid var(--border-soft)}
.wiz-head h2{margin:0 0 8px;font-size:18px;color:var(--ink)}
.wiz-progress{display:flex;gap:6px}
.wiz-dot{width:22px;height:4px;border-radius:999px;background:var(--border)}
.wiz-dot.on{background:var(--primary)}
.wiz-body{padding:16px 22px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:12px}
.wiz-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--border-soft)}
.wiz-foot-right{display:flex;gap:8px}
.wiz-typecards{display:flex;gap:14px;padding:16px 22px}
.wiz-typecard{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px;border:1px solid var(--border);border-radius:12px;background:#fff;cursor:pointer;font:inherit;font-weight:600;color:var(--ink)}
.wiz-typecard:hover{border-color:var(--primary);color:var(--primary)}
.wiz-typecard .msi{font-size:30px}
.wiz-trigs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
```

- [ ] **Step 4: Verificare sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "studio.js OK"
```
Expected: `studio.js OK`.

- [ ] **Step 5: Verifica funzionale (Playwright, opzionale ma consigliata)**

Avviare un'istanza con dataset importato; aprire `/lab/`, cliccare "Nuova anagrafica":
l'overlay wizard si apre con le due card (Cliente/Lead); scelto Cliente, si naviga tra gli
step (Identità → Polizze → Pagamenti → Scoperture → VIVA → Riepilogo); nel Riepilogo
compare l'elenco trigger; "Crea e testa" apre il dettaglio col record e l'NBA eseguito.

- [ ] **Step 6: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "Wizard: creazione anagrafica scenario-builder a step (cliente/lead)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Wizard scenario-builder cliente (5 step + riepilogo) e lead (2 + riepilogo) → Task 3 (`WIZARD_STEPS`). Riuso renderer (`renderField`/`renderArraySection`) → Task 3. Scoperture via `cross_sell_gaps` → step "Scoperture". Anteprima trigger nel riepilogo → `wizardPreview`. Crea+esegui NBA → `wizardFinish`. Apertura da "Nuova anagrafica" → Task 3 Step 2. Header: via user-chip + Tutorial, "Strumenti"→"Dati", `?tutorial=1` → Task 1. Pagina Dati + link Tool originale/Rivedi tutorial → Task 2. Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; codice completo; comandi con output atteso.

**Type consistency:** `openWizard`/`renderWizard`/`wizardFinish`/`wizardPreview`/`WIZ`/`WIZARD_STEPS` coerenti tra definizione (Task 3 Step 1) e uso (Step 2 aggancio); `renderField`/`renderArraySection` usati con la firma esistente `(f|sec, data)`; `?tutorial=1` prodotto in Task 2 e consumato in Task 1.

**Nota:** `Date.now()` è usato solo in codice browser dell'app (consentito), non in script di workflow.
