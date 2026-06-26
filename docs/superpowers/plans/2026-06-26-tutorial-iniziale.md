# Tutorial di utilizzo iniziale — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un overlay di benvenuto che, al primo avvio, spiega in 5 passi come usare NBA Studio, riapribile da un pulsante "?" nell'header.

**Architecture:** Solo frontend. Un overlay costruito in `studio.js` e appeso al body, mostrato in `init()` se manca il flag `localStorage["nba.lab.tutorial.seen"]`; "Ho capito" lo chiude e imposta il flag; un pulsante "?" nell'header lo riapre. Stile in `studio.css`.

**Tech Stack:** JS vanilla (`studio.js`), CSS (`studio.css`).

## Global Constraints

- Lavorare solo in `tangible_lab/static/` (`studio.js`, `studio.css`). Nessun backend.
- Lingua italiana per tutti i testi UI.
- Nessun framework di test: verifica via `node --check` + boot reale.
- Riusare gli helper esistenti di `studio.js` (`el(tag, props, ...children)`).
- Testi dei 5 passi: usare verbatim quelli sotto (dallo spec).
- Commit message in italiano, terminare con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Overlay tutorial di benvenuto

**Files:**
- Modify: `tangible_lab/static/studio.js` (costante LS, funzioni overlay, pulsante "?" header, chiamata in init)
- Modify: `tangible_lab/static/studio.css` (stili overlay)

**Interfaces:**
- Consumes: helper `el()` già presente in studio.js; `localStorage`.
- Produces: funzioni `buildTutorialOverlay()`, `showTutorial()`, `hideTutorial(markSeen)`; costante `LS_TUTORIAL`.

- [ ] **Step 1: Aggiungere la costante del flag localStorage**

In `tangible_lab/static/studio.js`, vicino alle altre costanti `LS_` (es. dopo
`const LS_HIDE_REVIEWED = "nba.lab.hideReviewed";`), aggiungere:

```javascript
  const LS_TUTORIAL = "nba.lab.tutorial.seen";
```

- [ ] **Step 2: Aggiungere le funzioni dell'overlay (subito prima di `async function init()`)**

In `tangible_lab/static/studio.js`, immediatamente **prima** della riga
`async function init() {`, inserire:

```javascript
  // ============================== Tutorial di utilizzo iniziale ==============================
  const TUTORIAL_STEPS = [
    ["Benvenuto in NBA Studio", "Ambiente Tangible per testare e validare le raccomandazioni del motore NBA di Vittoria."],
    ["Importa i dati", "L'app parte vuota: vai su Strumenti → Importa dataset e carica il file dataset.json."],
    ["Esplora le anagrafiche", "Nella lista a sinistra trovi clienti e lead con tier e punteggio; filtra per tier o tipo dalla sidebar."],
    ["Leggi la raccomandazione", "Selezionando un'anagrafica, nel pannello a destra vedi il Perché (i trigger), le Azioni consigliate e il breakdown del punteggio."],
    ["Valuta ed esporta", "Dai un giudizio (ok / ko / incerto), aggiungi una Nota, poi da Strumenti → Scarica Excel esporti tutto per condividere le considerazioni."],
  ];

  function buildTutorialOverlay() {
    if (document.getElementById("tut-overlay")) return;
    const list = el("ol", {class:"tut-steps"},
      ...TUTORIAL_STEPS.map(([t, d]) =>
        el("li", {}, el("strong", {}, t), el("span", {}, " — " + d))));
    const okBtn = el("button", {class:"btn primary-cta", type:"button"}, "Ho capito");
    okBtn.addEventListener("click", () => hideTutorial(true));
    const panel = el("div", {class:"tut-panel", role:"dialog", "aria-label":"Come iniziare"},
      el("div", {class:"tut-head"}, el("span", {class:"msi"}, "school"), el("h2", {}, "Come iniziare")),
      list,
      el("div", {class:"tut-actions"}, okBtn));
    const overlay = el("div", {id:"tut-overlay", class:"tut-overlay"}, panel);
    overlay.addEventListener("click", e => { if (e.target === overlay) hideTutorial(true); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) hideTutorial(true);
    });
    document.body.appendChild(overlay);
  }

  function showTutorial() {
    buildTutorialOverlay();
    document.getElementById("tut-overlay").classList.add("open");
  }

  function hideTutorial(markSeen) {
    const o = document.getElementById("tut-overlay");
    if (o) o.classList.remove("open");
    if (markSeen) localStorage.setItem(LS_TUTORIAL, "1");
  }

```

- [ ] **Step 3: Aggiungere il pulsante "?" nell'header**

In `tangible_lab/static/studio.js`, nel blocco che crea i link header, **subito dopo**
le righe che inseriscono `guidaLink` (cioè dopo
`headerActions.insertBefore(guidaLink, headerActions.children[0]);`), inserire:

```javascript
      // Pulsante "?" — riapre il tutorial di utilizzo iniziale
      const helpBtn = document.createElement("button");
      helpBtn.className = "home-link";
      helpBtn.type = "button";
      helpBtn.title = "Come iniziare — tutorial";
      helpBtn.innerHTML = '<span class="msi">help</span><span class="home-link-lbl">Tutorial</span>';
      helpBtn.addEventListener("click", () => showTutorial());
      headerActions.insertBefore(helpBtn, headerActions.children[0]);
```

- [ ] **Step 4: Mostrare l'overlay al primo avvio (in `init`)**

In `tangible_lab/static/studio.js`, subito **dopo** la riga `bindAll();` dentro `init()`,
inserire:

```javascript
    buildTutorialOverlay();
    if (!localStorage.getItem(LS_TUTORIAL)) showTutorial();
```

- [ ] **Step 5: Aggiungere gli stili in studio.css**

In coda a `tangible_lab/static/studio.css`, aggiungere:

```css
/* ============ Tutorial di benvenuto ============ */
.tut-overlay{display:none;position:fixed;inset:0;background:rgba(15,17,32,.5);backdrop-filter:blur(2px);z-index:1100;align-items:center;justify-content:center;padding:16px}
.tut-overlay.open{display:flex}
.tut-panel{background:#fff;border-radius:14px;padding:22px 24px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 16px 50px rgba(15,17,32,.25);display:flex;flex-direction:column;gap:14px}
.tut-head{display:flex;align-items:center;gap:10px}
.tut-head h2{margin:0;font-size:18px;color:var(--ink)}
.tut-head .msi{color:var(--primary);font-size:24px}
.tut-steps{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.5;color:var(--ink2)}
.tut-steps strong{color:var(--ink)}
.tut-actions{display:flex;justify-content:flex-end;margin-top:4px}
```

- [ ] **Step 6: Verificare la sintassi**

Run:
```bash
cd /Users/luscarpa/Sites/NBA
node --check tangible_lab/static/studio.js && echo "studio.js OK"
```
Expected: `studio.js OK`. (`studio.css` non ha check; verifica visiva al boot.)

- [ ] **Step 7: Verifica funzionale (boot reale)**

```bash
cd /Users/luscarpa/Sites/NBA
TANGIBLE_LAB_DATA_DIR="$(mktemp -d)" TANGIBLE_LAB_SINGLE_USER=1 .venv/bin/python -c "import tangible_lab.server as s; s.run(host='127.0.0.1', port=8215, open_ui=False)" &
sleep 6
curl -s -o /dev/null -w "/lab/ -> %{http_code}\n" http://127.0.0.1:8215/lab/
curl -s http://127.0.0.1:8215/lab/studio.js | grep -c "buildTutorialOverlay\|LS_TUTORIAL\|tut-overlay"
pkill -f "port=8215"
```
Expected: `/lab/ -> 200` e un conteggio > 0 (le nuove funzioni sono servite). Verifica visiva (manuale, opzionale): aprendo `http://127.0.0.1:8000/lab/` con localStorage pulito (incognito) l'overlay "Come iniziare" appare; "Ho capito" lo chiude e, ricaricando, non riappare; il pulsante "?" lo riapre.

- [ ] **Step 8: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "Tutorial: overlay di benvenuto al primo avvio (5 passi, riapribile da ?)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Overlay primo avvio + flag localStorage → Step 1, 2, 4. Pulsante "?" per riaprire → Step 3. "Ho capito" che imposta il flag → Step 2 (`hideTutorial(true)`). Chiusura con Esc e click sfondo → Step 2. 5 passi col testo verbatim → Step 2 (`TUTORIAL_STEPS`). Stile coerente/mobile-safe → Step 5 (`max-width`, `overflow:auto`, `padding`). Niente backend/carosello → rispettato. Tutto coperto.

**Placeholder scan:** nessun TBD/TODO; codice completo in ogni step; comandi con output atteso.

**Type consistency:** `LS_TUTORIAL` usato in Step 2 e 4; `buildTutorialOverlay`/`showTutorial`/`hideTutorial` definite in Step 2 e usate in Step 3/4; id `tut-overlay` e classi `.tut-*` coerenti tra JS (Step 2) e CSS (Step 5).
