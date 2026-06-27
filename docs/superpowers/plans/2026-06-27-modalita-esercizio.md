# Modalità esercizio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps con checkbox.

**Goal:** Toggle "Modalità esercizio" (sopra "Messaggi rivisti") che nasconde criticità e NBA; il tester ipotizza la criticità e poi la rivela, confrontandola con quella reale.

**Architecture:** Solo frontend (`index.html`, `studio.js`, `studio.css`). Hiding via classe `html.exercise-mode` (lista/cartelle/dettaglio); pannello ipotesi + reveal + banner confronto in JS, per-anagrafica, effimero.

**Tech Stack:** HTML/JS vanilla, CSS.

## Global Constraints
- Solo file del Lab `tangible_lab/static/{index.html,studio.js,studio.css}`. MAI file vendored.
- Italiano per copy/commenti. localStorage `nba.lab.*`. Working dir `/Users/luscarpa/Sites/NBA`, branch `modalita-esercizio`.
- Mappa tier→label: `CRITICAL:Critica, HIGH:Alta, MEDIUM:Media, LOW:Bassa`.
- Commit con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Modalità esercizio (toggle, hiding, pannello ipotesi + reveal + confronto)

**Files:** Modify `tangible_lab/static/index.html`, `studio.js`, `studio.css`

- [ ] **Step 1: Toggle in index.html (sopra "Messaggi rivisti") + data-sep**

In `.ml-side-actions`, **prima** della label `.rev-toggle` dei messaggi rivisti, inserire:

```html
        <label class="rev-toggle" title="Nascondi criticità e NBA: ipotizza tu, poi rivela">
          <input type="checkbox" id="exercise-toggle"/>
          <span class="msi">psychology</span>
          <span class="rev-toggle-lbl">Modalità esercizio</span>
        </label>
```

Nella sidebar folders, marcare la sep "Per priorità":
```html
        <li class="sep" data-sep="tier">Per priorità</li>
```

- [ ] **Step 2: STATE + costanti + label tier (studio.js)**

Nello STATE aggiungere (vicino a `revisedMessages`):
```js
    exerciseMode: false,      // modalità esercizio (nasconde criticità/NBA)
    revealed: {},             // reviewKey -> true (rivelati, effimero)
    hypotheses: {},           // reviewKey -> tier ipotizzato (effimero)
```
Vicino alle costanti `LS_*`:
```js
  const LS_EXERCISE = "nba.lab.exerciseMode";
```
Vicino a `REVIEW_META`/`TRIG_LABELS` (zona costanti):
```js
  const TIER_LABELS_IT = { CRITICAL:"Critica", HIGH:"Alta", MEDIUM:"Media", LOW:"Bassa" };
```

- [ ] **Step 3: Ordinamento neutro in renderListPane**

In `renderListPane`, sostituire `items = sortItems(items);` con:
```js
    items = STATE.exerciseMode
      ? items.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
      : sortItems(items);
```

- [ ] **Step 4: Integrazione in renderDetail (pannello / banner / tab forzata)**

In `renderDetail(it)`:
- subito dopo `pane.innerHTML = "";` aggiungere `pane.classList.remove("exercise-hidden");`
- sostituire la riga del tab di default (`STATE.detailTab = isNew ? "profile" : (valid.includes(tabFromLS) ? tabFromLS : "nba");`) con:
```js
    const exHidden = STATE.exerciseMode && !STATE.revealed[reviewKey(it)];
    STATE.detailTab = (isNew || exHidden) ? "profile" : (valid.includes(tabFromLS) ? tabFromLS : "nba");
```
- subito **prima** di `pane.appendChild(body);` aggiungere:
```js
    if (STATE.exerciseMode) {
      const exKey = reviewKey(it);
      if (!STATE.revealed[exKey]) {
        pane.classList.add("exercise-hidden");
        body.insertBefore(buildExercisePanel(it), body.firstChild);
      } else {
        body.insertBefore(buildExerciseResult(it), body.firstChild);
      }
    }
```

- [ ] **Step 5: Funzioni buildExercisePanel / buildExerciseResult (studio.js)**

Aggiungere vicino a `renderDetail`:
```js
  function buildExercisePanel(it) {
    const key = reviewKey(it);
    let guess = STATE.hypotheses[key] || null;
    const panel = el("div", {class:"exercise-panel"});
    panel.appendChild(el("div", {class:"exercise-panel-head"},
      el("span", {class:"msi"}, "psychology"), el("strong", {}, "Modalità esercizio")));
    panel.appendChild(el("div", {class:"exercise-panel-sub"},
      "Osserva il profilo e ipotizza la criticità di questa anagrafica, poi rivela quella del motore."));
    const reveal = el("button", {class:"btn primary-cta", type:"button"},
      el("span", {class:"msi"}, "visibility"), " Rivela criticità");
    reveal.disabled = !guess;
    const opts = el("div", {class:"exercise-opts"});
    ["CRITICAL","HIGH","MEDIUM","LOW"].forEach(t => {
      const b = el("button", {class:"exercise-opt" + (guess===t ? " sel "+t : ""), type:"button"}, TIER_LABELS_IT[t]);
      b.addEventListener("click", () => {
        guess = t; STATE.hypotheses[key] = t;
        opts.querySelectorAll(".exercise-opt").forEach(x => { x.className = "exercise-opt"; });
        b.className = "exercise-opt sel " + t;
        reveal.disabled = false;
      });
      opts.appendChild(b);
    });
    panel.appendChild(opts);
    reveal.addEventListener("click", () => { STATE.revealed[key] = true; loadAnagrafica(it); });
    panel.appendChild(reveal);
    return panel;
  }

  function buildExerciseResult(it) {
    const key = reviewKey(it);
    const guess = STATE.hypotheses[key];
    const actual = it.tier || STATE.lastResult?.priority_tier || null;
    const match = !!guess && guess === actual;
    return el("div", {class:"exercise-result " + (match ? "ok" : "ko")},
      el("span", {class:"msi"}, match ? "check_circle" : "cancel"),
      el("span", {}, "La tua ipotesi: "), el("strong", {}, TIER_LABELS_IT[guess] || guess || "—"),
      el("span", {}, " — Reale: "), el("strong", {}, TIER_LABELS_IT[actual] || actual || "—"));
  }
```

- [ ] **Step 6: Wiring del toggle in bindAll**

In `bindAll`, accanto agli altri toggle:
```js
    const exTgl = $("#exercise-toggle");
    if (exTgl) {
      exTgl.checked = STATE.exerciseMode;
      exTgl.addEventListener("change", () => {
        STATE.exerciseMode = exTgl.checked;
        localStorage.setItem(LS_EXERCISE, exTgl.checked ? "1" : "0");
        document.documentElement.classList.toggle("exercise-mode", exTgl.checked);
        STATE.revealed = {}; STATE.hypotheses = {};
        if (STATE.exerciseMode && String(STATE.folder).startsWith("tier:")) {
          STATE.folder = "all"; updateFolderActive();
        }
        renderListPane();
        if (STATE.selected) {
          const it = STATE.items.find(x => x.kind === STATE.selected.kind && x.id === STATE.selected.id);
          if (it) loadAnagrafica(it);
        }
      });
    }
```

- [ ] **Step 7: Init — lettura flag + classe + sync checkbox**

In `init`, accanto alla lettura di `LS_REVISED_MSG`/sync della relativa checkbox (dopo che i dati sono caricati o insieme agli altri toggle):
```js
    STATE.exerciseMode = localStorage.getItem(LS_EXERCISE) === "1";
    document.documentElement.classList.toggle("exercise-mode", STATE.exerciseMode);
    const exBoot = $("#exercise-toggle"); if (exBoot) exBoot.checked = STATE.exerciseMode;
```

- [ ] **Step 8: CSS (studio.css)**

Aggiungere (vicino agli stili `.rev-toggle` o in coda):
```css
/* ===== Modalità esercizio ===== */
html.exercise-mode .ml-item .ml-dot{background:var(--border)!important}
html.exercise-mode .ml-item .ml-score{display:none}
html.exercise-mode .ml-item .ml-snippet{display:none}
html.exercise-mode .ml-item .ml-foot .strat{display:none}
html.exercise-mode .ml-folders [data-sep="tier"],
html.exercise-mode .ml-folders li[data-folder^="tier:"]{display:none}
/* dettaglio non rivelato: niente tier/NBA */
html.exercise-mode .ml-detail-pane.exercise-hidden .ml-title .tier{display:none}
html.exercise-mode .ml-detail-pane.exercise-hidden .ml-detail-meta{display:none}
html.exercise-mode .ml-detail-pane.exercise-hidden .detail-tabs .dtab[data-tab="nba"]{display:none}
html.exercise-mode .ml-detail-pane.exercise-hidden .tab-pane[data-tab="nba"]{display:none}
/* pannello ipotesi */
.exercise-panel{background:linear-gradient(180deg,#FBFCFE,#F4F6FA);border:1px solid var(--border-soft);border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;flex-direction:column;gap:10px}
.exercise-panel-head{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--ink)}
.exercise-panel-head .msi{color:var(--primary)}
.exercise-panel-sub{font-size:12.5px;color:var(--ink2,#475569);line-height:1.5}
.exercise-opts{display:flex;gap:8px;flex-wrap:wrap}
.exercise-opt{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border:1px solid var(--border);border-radius:999px;background:#fff;color:var(--ink2,#475569);cursor:pointer}
.exercise-opt:hover{border-color:var(--primary);color:var(--primary)}
.exercise-opt.sel{color:#fff;border-color:transparent}
.exercise-opt.sel.CRITICAL{background:#dc2626}
.exercise-opt.sel.HIGH{background:#ea580c}
.exercise-opt.sel.MEDIUM{background:#ca8a04}
.exercise-opt.sel.LOW{background:#16a34a}
.exercise-panel .primary-cta{align-self:flex-start}
/* banner confronto */
.exercise-result{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13px;font-weight:600}
.exercise-result.ok{background:#DCFCE7;color:#166534;border:1px solid #86EFAC}
.exercise-result.ko{background:#FEE2E2;color:#991b1b;border:1px solid #FCA5A5}
.exercise-result .msi{font-size:18px}
```

- [ ] **Step 9: Verifica**
```bash
node --check tangible_lab/static/studio.js && echo OK
```
Poi verifica Playwright (la fa il controller): toggle ON → lista senza colore/punteggio/snippet, ordine per id, niente cartelle "Per priorità"; aprendo un record solo Profilo + pannello ipotesi (Rivela disabilitato); scelta tier → Rivela attivo → click → compaiono NBA + banner confronto ✓/✗; cambio record → di nuovo nascosto; toggle OFF → tutto visibile.

- [ ] **Step 10: Commit**
```bash
git add tangible_lab/static/index.html tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "feat(esercizio): modalità esercizio (nascondi criticità/NBA, ipotizza e rivela)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Self-Review
- Spec coverage: toggle sopra messaggi rivisti (Step 1), hiding lista/cartelle/ordine (Step 3,8), dettaglio profilo+pannello (Step 4,5,8), reveal+confronto (Step 5), reset su toggle (Step 6), init (Step 7). ✓
- Type/contract: `reviewKey`, `loadAnagrafica`, `updateFolderActive`, `sortItems`, `el`, `$` esistenti; `TIER_LABELS_IT` usata solo dove definita; nuove chiavi STATE inizializzate. ✓
- Rischi: il reveal usa `loadAnagrafica(it)` (re-render + runNBA) così l'NBA è popolato; `pane.classList.remove("exercise-hidden")` a inizio renderDetail evita residui tra record.
