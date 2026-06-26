# Ritocchi pannello di dettaglio — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab NBA/Profilo più evidenti, "Perché questa priorità?" comprimibile (chiusa di default), "Scoperture rilevate" dopo VIVA Points, header senza "Esegui NBA"/"Modifica record" e ricalcolo NBA su "Salva modifiche".

**Architecture:** Solo frontend. CSS per le tab (segmented control) e per la card comprimibile; JS per la card "Perché" collassabile, per un helper `renderProfileBody` (usato all'apertura e nel rerender, con il riquadro scoperture dopo VIVA), per la rimozione dei due bottoni header e per far ricalcolare l'NBA su salvataggio.

**Tech Stack:** JS vanilla (`studio.js`), CSS (`studio.css`).

## Global Constraints

- Solo `tangible_lab/static/studio.js` e `studio.css`. Nessun backend.
- Lingua italiana. Riuso helper esistenti: `el`, `renderForm`, `renderFormView`, `buildProfileIntro`, `runNBA`, `toast`, `coverageGapsFromResult`, `SCHEMAS`, `STATE`.
- Niente framework di test: `node --check` + verifica Playwright (fatta dal controllore).
- Commit message in italiano, terminare con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Tab NBA/Profilo come segmented control

**Files:**
- Modify: `tangible_lab/static/studio.css` (blocco `.detail-tabs`)

**Interfaces:**
- Consumes/Produces: niente (solo stile; il markup `.detail-tabs`/`.dtab`/`.dtab.active` resta).

- [ ] **Step 1: Sostituire il blocco `.detail-tabs` desktop**

In `tangible_lab/static/studio.css`, sostituire:
```css
.detail-tabs{display:flex;gap:0;margin:14px -18px -14px;padding:0 18px;border-top:1px solid var(--border-soft);background:#fff}
.detail-tabs .dtab{
  background:transparent;border:none;color:var(--muted);font-weight:600;
  font-size:12px;padding:11px 14px;cursor:pointer;border-bottom:2px solid transparent;
  display:inline-flex;align-items:center;gap:6px;font:inherit;letter-spacing:.02em
}
.detail-tabs .dtab:hover{color:var(--primary)}
.detail-tabs .dtab.active{color:var(--primary);border-bottom-color:var(--highlight)}
.detail-tabs .dtab .msi{font-size:16px}
```
con:
```css
.detail-tabs{display:flex;gap:4px;margin:14px 0 6px;padding:4px;background:var(--breeze, #eef1f7);border:1px solid var(--border-soft);border-radius:10px}
.detail-tabs .dtab{
  flex:1;justify-content:center;background:transparent;border:none;color:var(--ink2, #475569);font-weight:600;
  font-size:13px;padding:9px 14px;cursor:pointer;border-radius:8px;
  display:inline-flex;align-items:center;gap:6px;font:inherit;letter-spacing:.02em;transition:background .12s,color .12s
}
.detail-tabs .dtab:hover{color:var(--primary)}
.detail-tabs .dtab.active{background:var(--primary);color:#fff;box-shadow:0 1px 2px rgba(31,28,61,.14)}
.detail-tabs .dtab.active .msi{color:#fff}
.detail-tabs .dtab .msi{font-size:18px}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luscarpa/Sites/NBA
git add tangible_lab/static/studio.css
git commit -m "Detail: tab NBA/Profilo come segmented control (più evidenti)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: "Perché questa priorità?" comprimibile (chiusa di default)

**Files:**
- Modify: `tangible_lab/static/studio.js` (card "Perché" nel rendering risultato)
- Modify: `tangible_lab/static/studio.css` (stili collassabile)

**Interfaces:**
- Consumes: `renderExplanation(out)` (esistente).
- Produces: card collassabile con classi `.collapsible`/`.collapsed`.

- [ ] **Step 1: Rendere collassabile la card "Perché"**

In `tangible_lab/static/studio.js`, sostituire:
```javascript
    // Card 2: Perché questa priorità
    wrap.appendChild(el("div", {class:"section-block"},
      el("div", {class:"section-head"},
        el("span", {class:"msi section-ico"}, "psychology"),
        el("h3", {}, "Perché questa priorità?")
      ),
      el("div", {class:"section-body"}, renderExplanation(out))
    ));
```
con:
```javascript
    // Card 2: Perché questa priorità (comprimibile, chiusa di default)
    const whyCard = el("div", {class:"section-block collapsible collapsed"});
    const whyHead = el("div", {class:"section-head section-head-toggle"},
      el("span", {class:"msi section-ico"}, "psychology"),
      el("h3", {}, "Perché questa priorità?"),
      el("span", {class:"msi collapse-caret"}, "expand_more"));
    whyHead.addEventListener("click", () => whyCard.classList.toggle("collapsed"));
    whyCard.appendChild(whyHead);
    whyCard.appendChild(el("div", {class:"section-body"}, renderExplanation(out)));
    wrap.appendChild(whyCard);
```

- [ ] **Step 2: Stili collassabile (in coda a studio.css)**

```css
/* ============ Card comprimibile (es. Perché questa priorità) ============ */
.section-block.collapsible .section-head-toggle{cursor:pointer}
.section-block.collapsible .collapse-caret{margin-left:auto;transition:transform .15s;color:var(--muted)}
.section-block.collapsible.collapsed .section-body{display:none}
.section-block.collapsible.collapsed .collapse-caret{transform:rotate(-90deg)}
```

- [ ] **Step 3: Verifica sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "JS OK"
```
Expected: `JS OK`.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "Detail: 'Perché questa priorità?' comprimibile, chiusa di default

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Header snello + Profilo (scoperture dopo VIVA, ricalcolo su salva)

**Files:**
- Modify: `tangible_lab/static/studio.js` (header actions, fillProfileGaps, nuovo renderProfileBody, profile pane build, rerenderProfilePane, saveProfileEdit)

**Interfaces:**
- Consumes: `buildProfileIntro`, `renderForm`, `renderFormView`, `fillProfileGaps`, `runNBA`, `SCHEMAS`, `STATE`.
- Produces: `renderProfileBody(pane)`.

- [ ] **Step 1: Rimuovere i due bottoni dall'header**

In `tangible_lab/static/studio.js`, nella riga `.ml-detail-actions`, eliminare le due righe:
```javascript
        el("button", {class:"btn primary-cta", onclick: () => { switchDetailTab("nba"); runNBA(); }, id:"detail-run"}, el("span", {class:"msi"}, "play_arrow"), " Esegui NBA"),
        el("button", {class:"btn ghost", onclick: () => { startProfileEdit(); switchDetailTab("profile"); }}, el("span", {class:"msi"}, "edit"), " Modifica record"),
```
(Restano "Salva caso" ed "Elimina".)

- [ ] **Step 2: `fillProfileGaps` accetta un box opzionale**

Sostituire la firma e la prima riga:
```javascript
  function fillProfileGaps() {
    const box = document.getElementById("profile-gaps");
    if (!box) return;
```
con:
```javascript
  function fillProfileGaps(box) {
    box = box || document.getElementById("profile-gaps");
    if (!box) return;
```

- [ ] **Step 3: Aggiungere l'helper `renderProfileBody` (subito prima di `function buildProfileIntro()`)**

```javascript
  // Costruisce il corpo della tab Profilo: intro + form, con il riquadro
  // "Scoperture rilevate" inserito subito dopo la sezione "VIVA Points".
  function renderProfileBody(pane) {
    pane.innerHTML = "";
    pane.appendChild(buildProfileIntro());
    const form = STATE.profileEdit
      ? renderForm(SCHEMAS[STATE.selected.type], STATE.record)
      : renderFormView(SCHEMAS[STATE.selected.type], STATE.record);
    pane.appendChild(form);
    const gaps = el("div", {id:"profile-gaps"});
    const viva = [...form.querySelectorAll(".section-block")].find(b => /VIVA Points/.test(b.textContent));
    if (viva) viva.after(gaps); else form.appendChild(gaps);
    fillProfileGaps(gaps);
  }
```

- [ ] **Step 4: Usare l'helper nella costruzione iniziale del Profilo**

Sostituire (nel `renderDetail`):
```javascript
    // ---- Profile tab pane ----
    const profilePane = el("div", {class:"tab-pane", "data-tab":"profile"});
    profilePane.appendChild(buildProfileIntro());
    profilePane.appendChild(el("div", {id:"profile-gaps"}));
    profilePane.appendChild(STATE.profileEdit
      ? renderForm(SCHEMAS[STATE.selected.type], STATE.record)
      : renderFormView(SCHEMAS[STATE.selected.type], STATE.record));
    fillProfileGaps();
    body.appendChild(profilePane);
```
con:
```javascript
    // ---- Profile tab pane ----
    const profilePane = el("div", {class:"tab-pane", "data-tab":"profile"});
    renderProfileBody(profilePane);
    body.appendChild(profilePane);
```

- [ ] **Step 5: Usare l'helper nel rerender del Profilo**

Sostituire la funzione `rerenderProfilePane`:
```javascript
  function rerenderProfilePane() {
    const pane = document.querySelector('.tab-pane[data-tab="profile"]');
    if (!pane) return;
    pane.innerHTML = "";
    pane.appendChild(buildProfileIntro());
    pane.appendChild(STATE.profileEdit
      ? renderForm(SCHEMAS[STATE.selected.type], STATE.record)
      : renderFormView(SCHEMAS[STATE.selected.type], STATE.record));
  }
```
con:
```javascript
  function rerenderProfilePane() {
    const pane = document.querySelector('.tab-pane[data-tab="profile"]');
    if (!pane) return;
    renderProfileBody(pane);
  }
```

- [ ] **Step 6: "Salva modifiche" ricalcola l'NBA**

Sostituire `saveProfileEdit`:
```javascript
  function saveProfileEdit() {
    STATE.profileEdit = false;
    STATE.profileBackup = null;
    rerenderProfilePane();
    toast("Modifiche applicate — puoi ora rieseguire l'NBA", "ok");
  }
```
con:
```javascript
  function saveProfileEdit() {
    STATE.profileEdit = false;
    STATE.profileBackup = null;
    rerenderProfilePane();
    runNBA();
    toast("Modifiche applicate — NBA ricalcolato", "ok");
  }
```

- [ ] **Step 7: Verifica sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "JS OK"
grep -c '"Esegui NBA"\|"Modifica record"\| Esegui NBA\| Modifica record' tangible_lab/static/studio.js
```
Expected: `JS OK`; il grep NON deve trovare i due bottoni rimossi (0 per " Esegui NBA"/" Modifica record" come label di bottone header — eventuali altre occorrenze testuali in commenti/wizard non contano).

- [ ] **Step 8: Commit**

```bash
git add tangible_lab/static/studio.js
git commit -m "Detail: header senza Esegui NBA/Modifica record; scoperture dopo VIVA; Salva modifiche ricalcola NBA

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Tab più evidenti → Task 1. "Perché" comprimibile chiusa di default → Task 2 (classe `collapsed` iniziale). Scoperture dopo VIVA → Task 3 (`renderProfileBody` inserisce `#profile-gaps` dopo la sezione "VIVA Points") + risolve la sparizione post-edit (stesso helper in `rerenderProfilePane`). Header senza i due bottoni → Task 3 Step 1. "Salva modifiche" ricalcola → Task 3 Step 6 (`runNBA()`). Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; codice completo; comandi con output atteso.

**Type consistency:** `renderProfileBody(pane)` definita (Step 3) e usata in renderDetail (Step 4) e rerenderProfilePane (Step 5); `fillProfileGaps(box)` con box opzionale (Step 2) chiamata con elemento in `renderProfileBody` (evita il trap getElementById su pane non ancora nel DOM) e senza arg in `runNBA` (DOM già montato). `runNBA` esistente, con guard `if (btn)` su `#detail-run` rimosso → nessun crash. La sezione "VIVA Points" è prodotta sia da `renderForm` sia da `renderFormView` come `.section-block` con `h3` "VIVA Points".
