# Filtri giudizio + responsive + rimozione tile Modalità — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere la tile "Modalità" dal Riepilogo priorità, aggiungere filtri avanzati per giudizio operatore in un pannello a comparsa, e sistemare il responsive nella fascia tablet/finestra stretta (760–1000px).

**Architecture:** Solo frontend del Lab (`tangible_lab/static/`), vanilla JS + CSS, nessun backend. Lo stato dei filtri vive in `STATE.judgeFilter` ed è persistito in `localStorage`. Il responsive si corregge spostando la "modalità compatta" (drawer + swap lista/dettaglio) da ≤760px a ≤1000px, lasciando a ≤760px solo le rifiniture cosmetiche.

**Tech Stack:** HTML statico (`index.html`), JS vanilla (`studio.js`), CSS (`studio.css`). Nessun framework, nessun build, nessun test runner.

## Global Constraints

- Modificare SOLO file del Lab: `tangible_lab/static/studio.js`, `tangible_lab/static/studio.css`, `tangible_lab/static/index.html`. MAI file vendored (`static/` in root, `nba_*.py`, `dataset.json`, ecc.).
- Lingua **italiana** per ogni copy UI e commento.
- Chiavi `localStorage` sotto namespace `nba.lab.*`.
- I tre `judgement` del motore review sono: `ok` = "Corretto", `ko` = "Sbagliato", `unsure` = "Da verificare". Più la pseudo-chiave `none` = "Non ancora giudicati".
- Verifica per ogni task: `node --check tangible_lab/static/studio.js` (quando il JS cambia) + verifica Playwright sul server attivo (`http://127.0.0.1:8000/lab/`).
- Commit message in italiano, con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Rimuovere la tile "Modalità" dal Riepilogo priorità

**Files:**
- Modify: `tangible_lab/static/studio.js` (~1013, ~1038)

**Interfaces:**
- Consumes: niente.
- Produces: niente (rimozione pura).

- [ ] **Step 1: Rimuovere la tile e la variabile inutilizzata**

In `tangible_lab/static/studio.js`, rimuovere la riga della tile (~1038):

```js
            statTile("Modalità", presLabel, "view_compact"),
```

E rimuovere la variabile non più usata (~1013):

```js
    const presLabel = out.presentation_mode || "—";
```

Lasciare invariate tutte le altre tile (`Strategia`, `Trigger attivi`, `Azioni totali`, `Fattore dominante`) e la meta "Modalità: …" nell'header del dettaglio (~927) **resta dov'è**.

- [ ] **Step 2: Verificare la sintassi**

Run: `node --check tangible_lab/static/studio.js`
Expected: nessun output (exit 0).

- [ ] **Step 3: Verifica Playwright**

Aprire `http://127.0.0.1:8000/lab/`, selezionare un'anagrafica, attendere il calcolo NBA. Nella card "Riepilogo priorità" la tile "Modalità" NON deve più comparire; le altre tile sì.

- [ ] **Step 4: Commit**

```bash
git add tangible_lab/static/studio.js
git commit -m "feat(fase10): rimuove tile Modalità dal Riepilogo priorità

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Filtri avanzati per giudizio operatore (stato + UI popover)

**Files:**
- Modify: `tangible_lab/static/index.html` (~67–73, toolbar)
- Modify: `tangible_lab/static/studio.js` (STATE ~182, costanti ~199, `renderListPane` ~577, `loadReviewsFromAPI` ~2273, nuove funzioni dopo `REVIEW_META` ~2293, `bindAll` ~2363–2372)
- Modify: `tangible_lab/static/studio.css` (~761–765, `.ml-list-toolbar` + nuove regole popover)

**Interfaces:**
- Consumes: `getReview(it)` → `{judgement}` o `undefined`; `renderListPane()`; `$()` selector helper; `el()` (non necessario, UI è in HTML).
- Produces: `STATE.judgeFilter = {ok, ko, unsure, none}` (booleani); `loadJudgeFilter()`, `saveJudgeFilter()`, `updateFilterBadge()`, `initJudgeFilterUI()`.

- [ ] **Step 1: Stato + costante localStorage**

In `studio.js`, sostituire nello STATE (~182):

```js
    hideReviewed: false,      // filtro lista
```

con:

```js
    judgeFilter: { ok:true, ko:true, unsure:true, none:true },  // filtro lista per giudizio operatore
```

Subito dopo la costante `LS_HIDE_REVIEWED` (~199) aggiungere:

```js
  const LS_JUDGE_FILTER = "nba.lab.judgeFilter";
```

(La costante `LS_HIDE_REVIEWED` resta: serve per la migrazione soft.)

- [ ] **Step 2: Funzioni load/save del filtro**

In `studio.js`, subito dopo la chiusura dell'oggetto `REVIEW_META` (~2293, prima di `loadSnapshotsFromLS`), aggiungere:

```js
  function loadJudgeFilter() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LS_JUDGE_FILTER) || "null"); } catch { stored = null; }
    if (stored && typeof stored === "object") {
      STATE.judgeFilter = {
        ok:     stored.ok     !== false,
        ko:     stored.ko     !== false,
        unsure: stored.unsure !== false,
        none:   stored.none   !== false
      };
      return;
    }
    // Migrazione soft dal vecchio toggle "Nascondi analizzati"
    if (localStorage.getItem(LS_HIDE_REVIEWED) === "1") {
      STATE.judgeFilter = { ok:false, ko:false, unsure:false, none:true };
    } else {
      STATE.judgeFilter = { ok:true, ko:true, unsure:true, none:true };
    }
    saveJudgeFilter();
  }
  function saveJudgeFilter() {
    localStorage.setItem(LS_JUDGE_FILTER, JSON.stringify(STATE.judgeFilter));
  }
```

- [ ] **Step 3: Inizializzare il filtro al caricamento review**

In `studio.js`, dentro `loadReviewsFromAPI` (~2273), sostituire:

```js
    STATE.hideReviewed = localStorage.getItem(LS_HIDE_REVIEWED) === "1";
```

con:

```js
    loadJudgeFilter();
```

- [ ] **Step 4: Applicare il filtro in `renderListPane`**

In `studio.js`, in `renderListPane` (~577), sostituire:

```js
    if (STATE.hideReviewed) items = items.filter(it => !getReview(it));
```

con:

```js
    items = items.filter(it => {
      const rev = getReview(it);
      const key = rev ? rev.judgement : "none";
      return STATE.judgeFilter[key] !== false;
    });
```

- [ ] **Step 5: Markup del pannello filtri in `index.html`**

In `tangible_lab/static/index.html`, sostituire l'intero blocco `.ml-list-toolbar` (~67–73):

```html
        <div class="ml-list-toolbar">
          <label class="filter-toggle">
            <input type="checkbox" id="hide-reviewed-toggle"/>
            <span class="msi">visibility_off</span>
            <span>Nascondi analizzati</span>
          </label>
        </div>
```

con:

```html
        <div class="ml-list-toolbar">
          <button type="button" id="filter-btn" class="filter-btn" aria-haspopup="true" aria-expanded="false">
            <span class="msi">tune</span>
            <span>Filtri</span>
            <span class="filter-badge" id="filter-badge" hidden>0</span>
          </button>
          <div class="filter-popover" id="filter-popover" hidden role="group" aria-label="Filtri per giudizio operatore">
            <div class="filter-popover-title">Giudizio operatore</div>
            <label class="filter-check"><input type="checkbox" data-judge="ok"/><span>Corretto</span></label>
            <label class="filter-check"><input type="checkbox" data-judge="ko"/><span>Sbagliato</span></label>
            <label class="filter-check"><input type="checkbox" data-judge="unsure"/><span>Da verificare</span></label>
            <label class="filter-check"><input type="checkbox" data-judge="none"/><span>Non ancora giudicati</span></label>
            <button type="button" class="filter-reset" id="filter-reset">Azzera filtri</button>
          </div>
        </div>
```

- [ ] **Step 6: Wiring del popover in `studio.js`**

In `studio.js`, dentro `bindAll` (~2363–2372), sostituire il blocco del toggle:

```js
    // hide-reviewed toggle
    const tgl = $("#hide-reviewed-toggle");
    if (tgl) {
      tgl.checked = STATE.hideReviewed;
      tgl.addEventListener("change", () => {
        STATE.hideReviewed = tgl.checked;
        localStorage.setItem(LS_HIDE_REVIEWED, tgl.checked ? "1" : "0");
        renderListPane();
      });
    }
```

con:

```js
    // filtri giudizio operatore (popover)
    initJudgeFilterUI();
```

Poi aggiungere, come funzioni autonome subito prima di `function bindAll() {` (~2351):

```js
  function updateFilterBadge() {
    const badge = $("#filter-badge");
    if (!badge) return;
    const excluded = ["ok","ko","unsure","none"].filter(k => STATE.judgeFilter[k] === false).length;
    if (excluded > 0) { badge.textContent = String(excluded); badge.hidden = false; }
    else { badge.hidden = true; }
  }
  function initJudgeFilterUI() {
    const btn = $("#filter-btn");
    const pop = $("#filter-popover");
    if (!btn || !pop) return;
    pop.querySelectorAll("input[data-judge]").forEach(inp => {
      inp.checked = STATE.judgeFilter[inp.dataset.judge] !== false;
      inp.addEventListener("change", () => {
        STATE.judgeFilter[inp.dataset.judge] = inp.checked;
        saveJudgeFilter();
        updateFilterBadge();
        renderListPane();
      });
    });
    updateFilterBadge();
    const close = () => { pop.hidden = true; btn.setAttribute("aria-expanded","false"); };
    const open  = () => { pop.hidden = false; btn.setAttribute("aria-expanded","true"); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
    document.addEventListener("click", (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) close(); });
    $("#filter-reset").addEventListener("click", () => {
      STATE.judgeFilter = { ok:true, ko:true, unsure:true, none:true };
      saveJudgeFilter();
      pop.querySelectorAll("input[data-judge]").forEach(inp => { inp.checked = true; });
      updateFilterBadge();
      renderListPane();
    });
  }
```

- [ ] **Step 7: CSS del pannello filtri**

In `studio.css`, sostituire il blocco `.ml-list-toolbar` + `.filter-toggle` (~761–765):

```css
.ml-list-toolbar{display:flex;align-items:center;justify-content:flex-end;margin-top:8px}
.filter-toggle{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--muted);font-weight:600;user-select:none}
.filter-toggle .msi{font-size:16px}
.filter-toggle input{margin:0;cursor:pointer}
.filter-toggle:has(input:checked){color:var(--primary)}
```

con:

```css
.ml-list-toolbar{display:flex;align-items:center;justify-content:flex-end;margin-top:8px;position:relative;flex-wrap:wrap;gap:6px}
.filter-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font:inherit;font-size:11px;font-weight:600;color:var(--muted);background:#fff;border:1px solid var(--border);border-radius:8px;padding:5px 10px}
.filter-btn:hover{color:var(--primary);border-color:var(--primary)}
.filter-btn .msi{font-size:16px}
.filter-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--primary);color:#fff;font-size:10px;font-weight:700;line-height:1}
.filter-popover{position:absolute;top:100%;right:0;margin-top:6px;z-index:20;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(15,17,32,.12);padding:10px;min-width:210px}
.filter-popover-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
.filter-check{display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;cursor:pointer;border-radius:6px}
.filter-check:hover{background:var(--breeze)}
.filter-check input{margin:0;cursor:pointer}
.filter-reset{margin-top:8px;width:100%;background:var(--breeze);border:1px solid var(--border-soft);border-radius:8px;padding:6px;font:inherit;font-size:12px;font-weight:600;color:var(--ink2,#475569);cursor:pointer}
.filter-reset:hover{color:var(--primary);border-color:var(--primary)}
```

- [ ] **Step 8: Verificare la sintassi**

Run: `node --check tangible_lab/static/studio.js`
Expected: nessun output (exit 0).

- [ ] **Step 9: Verifica Playwright**

Aprire `http://127.0.0.1:8000/lab/`:
1. Il toggle "Nascondi analizzati" NON è più nella toolbar; al suo posto c'è il bottone "Filtri".
2. Click su "Filtri" apre il pannello con le 4 checkbox tutte spuntate; il badge è nascosto.
3. Deselezionare "Corretto": gli item con giudizio Corretto spariscono dalla lista; il badge mostra "1".
4. "Azzera filtri" rimette tutte le checkbox spuntate, badge nascosto, lista completa.
5. Click fuori dal pannello (o `Esc`) lo chiude.
6. Ricaricare la pagina (Cmd+R): lo stato dei filtri persiste.

- [ ] **Step 10: Commit**

```bash
git add tangible_lab/static/index.html tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "feat(fase10): filtri avanzati per giudizio operatore con pannello a comparsa

Sostituisce il toggle 'Nascondi analizzati' con un pannello filtri
(Corretto/Sbagliato/Da verificare/Non ancora giudicati) con badge e
azzera filtri. Stato persistito in localStorage, migrazione soft dal
vecchio toggle.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Responsive — modalità compatta da ≤1000px

**Files:**
- Modify: `tangible_lab/static/studio.css` (rimozione riga ~803; nuovo blocco `@media (max-width:1000px)`; rimozione regole strutturali dal blocco `@media (max-width:760px)` ~975+)

**Interfaces:**
- Consumes: classi/selettori esistenti (`.ml-layout`, `aside.ml-sidebar`, `.ml-list-pane`, `.ml-detail-pane`, `.mobile-menu`, `.mobile-overlay`, `html.has-selection`, `html.mobile-sidebar-open`).
- Produces: niente (solo CSS).

**Razionale:** oggi a ≤1000px la griglia collassa a `1fr` con `height:auto;overflow:visible` (riga ~803) ma la modalità compatta (drawer + swap lista/dettaglio + contenimento altezza) scatta solo a ≤760px → nella fascia 760–1000px tutto si impila senza scroll interno (lista a ~47000px di altezza, dettaglio fuori schermo). Si alza la soglia strutturale a 1000px **estraendo** le regole strutturali dal blocco 760 (niente duplicazione); le rifiniture cosmetiche restano a ≤760px.

- [ ] **Step 1: Rimuovere la riga 803 (causa dello stacking)**

In `studio.css`, eliminare la riga:

```css
@media (max-width:1000px){.ml-layout, .ml-layout.sidebar-collapsed, html.sidebar-collapsed .ml-layout{grid-template-columns:1fr;height:auto;overflow:visible}}
```

- [ ] **Step 2: Inserire il nuovo blocco strutturale ≤1000px**

In `studio.css`, **al posto** della riga rimossa allo Step 1 (subito dopo la chiusura del blocco `@media (max-width:1200px){…}` ~799–802), inserire:

```css
/* Modalità compatta (tablet/finestra stretta): drawer sidebar + swap lista/dettaglio.
   Le rifiniture cosmetiche "telefono" restano nel blocco @media (max-width:760px). */
@media (max-width:1000px){
  .mobile-menu{display:inline-flex;align-items:center;justify-content:center}
  body.ml-mode .ml-layout,
  body.ml-mode .ml-layout.sidebar-collapsed,
  html.sidebar-collapsed body.ml-mode .ml-layout{
    display:block;
    height:calc(100vh - 64px);
    overflow:hidden
  }
  body.ml-mode section.ml-list-pane,
  body.ml-mode section.ml-detail-pane{height:100%;width:100%}

  /* Sidebar come drawer */
  aside.ml-sidebar{
    position:fixed;top:64px;left:0;bottom:0;width:260px;z-index:30;
    transform:translateX(-100%);transition:transform .22s ease;
    border-right:1px solid var(--border);box-shadow:2px 0 12px rgba(15,17,32,.08)
  }
  html.mobile-sidebar-open aside.ml-sidebar{transform:translateX(0)}
  html.mobile-sidebar-open .mobile-overlay{display:block}
  html.sidebar-collapsed aside.ml-sidebar, .ml-layout.sidebar-collapsed aside.ml-sidebar{width:260px}
  .sidebar-toggle{display:none}

  /* List vs detail: schermo intero, navigazione via has-selection */
  section.ml-list-pane{display:flex;flex-direction:column}
  section.ml-detail-pane{display:none;flex-direction:column}
  html.has-selection section.ml-list-pane{display:none}
  html.has-selection section.ml-detail-pane{display:flex}

  /* Detail-pane scrolla, head non sticky */
  .ml-detail-pane{overflow-y:auto;overflow-x:hidden}
  .ml-detail-head{position:static !important}
}
```

- [ ] **Step 3: Rimuovere `.mobile-menu` dal blocco ≤760px**

Nel blocco `@media (max-width:760px)`, eliminare la riga (~987):

```css
  .mobile-menu{display:inline-flex;align-items:center;justify-content:center}
```

- [ ] **Step 4: Rimuovere il blocco layout + panes dal ≤760px**

Eliminare il commento e le regole (~989–1001):

```css
  /* Layout mobile: niente grid, list e detail si scambiano via display.
     La sidebar è position:fixed quindi non occupa flow.
     Selettore body.ml-mode .ml-layout per vincere la specificità (0,2,1)
     rispetto alla regola desktop (0,1,0) definita dopo nel file. */
  body.ml-mode .ml-layout,
  body.ml-mode .ml-layout.sidebar-collapsed,
  html.sidebar-collapsed body.ml-mode .ml-layout{
    display:block;
    height:calc(100vh - 56px);
    overflow:hidden
  }
  body.ml-mode section.ml-list-pane,
  body.ml-mode section.ml-detail-pane{height:100%;width:100%}
```

- [ ] **Step 5: Rimuovere il blocco sidebar drawer dal ≤760px**

Eliminare il commento e le regole (~1003–1016):

```css
  /* Sidebar come drawer */
  aside.ml-sidebar{
    position:fixed;top:56px;left:0;bottom:0;width:260px;z-index:30;
    transform:translateX(-100%);transition:transform .22s ease;
    border-right:1px solid var(--border);box-shadow:2px 0 12px rgba(15,17,32,.08)
  }
  html.mobile-sidebar-open aside.ml-sidebar{transform:translateX(0)}
  html.mobile-sidebar-open .mobile-overlay{display:block}
  /* In mobile la sidebar è sempre espansa: ignora sidebar-collapsed */
  html.sidebar-collapsed aside.ml-sidebar, .ml-layout.sidebar-collapsed aside.ml-sidebar{width:260px}
  html.sidebar-collapsed .ml-folders li .lbl, html.sidebar-collapsed .ml-folders li .cnt,
  html.sidebar-collapsed .ml-folders li.sep, html.sidebar-collapsed .ml-side-actions .btn .lbl{display:revert}
  html.sidebar-collapsed .ml-folders li{justify-content:flex-start;padding:8px 10px;gap:8px}
  .sidebar-toggle{display:none}
```

> Nota: le tre regole `html.sidebar-collapsed .ml-folders li …` (ripristino label/padding della sidebar quando espansa come drawer) servono ancora a ≤1000px. Reinserirle nel nuovo blocco ≤1000px (Step 2) subito dopo `.sidebar-toggle{display:none}`:
> ```css
>   html.sidebar-collapsed .ml-folders li .lbl, html.sidebar-collapsed .ml-folders li .cnt,
>   html.sidebar-collapsed .ml-folders li.sep, html.sidebar-collapsed .ml-side-actions .btn .lbl{display:revert}
>   html.sidebar-collapsed .ml-folders li{justify-content:flex-start;padding:8px 10px;gap:8px}
> ```

- [ ] **Step 6: Rimuovere il blocco swap lista/dettaglio dal ≤760px**

Eliminare il commento e le regole (~1018–1023):

```css
  /* List vs detail: schermo intero, navigazione tramite has-selection.
     Mantengono display:flex (column) per far scrollare la list/detail body. */
  section.ml-list-pane{display:flex;flex-direction:column}
  section.ml-detail-pane{display:none;flex-direction:column}
  html.has-selection section.ml-list-pane{display:none}
  html.has-selection section.ml-detail-pane{display:flex}
```

- [ ] **Step 7: Rimuovere overflow detail-pane + head static dal ≤760px**

Eliminare il commento e le regole (~1025–1027):

```css
  /* Detail-pane: head NON sticky, body scrolla con tutto */
  .ml-detail-pane{overflow-y:auto;overflow-x:hidden}
  .ml-detail-head{position:static !important;padding:10px 12px}
```

(`position:static` e l'overflow sono ora garantiti dal blocco ≤1000px; il `padding` del detail-head a ≤760px è già ridefinito poco sotto da `.ml-detail-head{padding:8px 10px}`.)

- [ ] **Step 8: Verifica Playwright a 768 / 900 / 1000px**

Sul server attivo, per ciascuna larghezza (es. 768, 900, 1000):
1. `aside.ml-sidebar` non è in-flow a piena larghezza: è un drawer fuori schermo (transform translateX(-100%)); il bottone hamburger `.mobile-menu` è visibile e lo apre.
2. La `.ml-list-pane` NON renderizza a piena altezza (la sua altezza è ≈ viewport, con scroll interno): misurare `getBoundingClientRect().height` < 2× viewport.
3. Selezionando un'anagrafica, la lista si nasconde e compare il dettaglio con il bottone "indietro"; il bottone riporta alla lista.
4. Nessun overflow orizzontale del documento (`document.documentElement.scrollWidth <= window.innerWidth`).
5. A ≥1001px (es. 1200px) il layout resta a 3 colonne (griglia), nessuna regressione.

- [ ] **Step 9: Commit**

```bash
git add tangible_lab/static/studio.css
git commit -m "fix(fase10): modalità compatta responsive da tablet (<=1000px)

Sposta drawer sidebar + swap lista/dettaglio + contenimento altezza da
<=760px a <=1000px, eliminando lo stacking verticale senza scroll nella
fascia 760-1000px. Le rifiniture cosmetiche restano a <=760px.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Obiettivo 1 (rimuovere tile Modalità) → Task 1. ✅
- Obiettivo 2 (filtri giudizio in popover, assorbe "Nascondi analizzati", persistenza, migrazione) → Task 2. ✅
- Obiettivo 3 (responsive 760–1000: drawer + swap, niente cosmetico a tablet) → Task 3. ✅

**Placeholder scan:** nessun TBD/TODO; ogni step contiene il codice esatto. ✅

**Type consistency:** `STATE.judgeFilter` usa chiavi `ok|ko|unsure|none` in modo coerente fra Step 1/2/3/4/6 di Task 2 e nei `data-judge` del markup (Step 5). `loadJudgeFilter`/`saveJudgeFilter`/`updateFilterBadge`/`initJudgeFilterUI` definite e usate coerentemente. ✅

**Note di rischio:** Task 3 fa rimozioni chirurgiche nel blocco ≤760px; la verifica Playwright a 768/900/1000px (Step 8) è il gate che conferma che la sidebar si apra e lo swap funzioni.
