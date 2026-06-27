# Esercizio: ordina le azioni (vere/false) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Nella modalità esercizio, oltre a ipotizzare la criticità, il tester ordina 5 azioni (alcune reali, alcune esche) per priorità; alla rivelazione si verifica vere/false e l'ordine.

**Architecture:** Solo frontend (`tangible_lab/static/studio.js`, `studio.css`). Set di card effimero per record in `STATE.exerciseActions`. Drag & drop HTML5. Reveal unico (criticità + azioni).

## Global Constraints
- Solo `tangible_lab/static/studio.js` e `studio.css`. MAI file vendored. Italiano.
- Branch `esercizio-ordina-azioni`. Commit con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 5 card totali: fino a 4 reali (testo via `reviseMessage`) + esche fino a 5 (sempre ≥1 esca), mescolate. `rank` = indice priorità motore (0=top) per le reali.

---

### Task 1: Ordinamento azioni nell'esercizio

**Files:** Modify `tangible_lab/static/studio.js`, `studio.css`

- [ ] **Step 1: Salvare le azioni reali sull'item (buildItems)**

In `buildItems`, per i predef client e lead, aggiungere il campo `nba`:
- nel push del client: dopo `data: c.client_json` aggiungere `, nba: c.nba || []`
- nel push del lead: dopo `data: l.lead_json` aggiungere `, nba: l.nba || []`

- [ ] **Step 2: STATE + pool esche + helper (studio.js)**

In STATE, accanto a `exerciseMode/revealed/hypotheses`, aggiungere:
```js
    exerciseActions: {},      // reviewKey -> array card {text,isReal,rank} (ordine del giocatore)
```
Vicino alle altre costanti (es. dopo `TIER_LABELS_IT`):
```js
  const DECOY_ACTIONS = [
    "Inviare la newsletter mensile",
    "Programmare una telefonata di cortesia",
    "Proporre un upgrade della polizza Auto",
    "Inviare un questionario di soddisfazione",
    "Aggiornare i dati di contatto",
    "Proporre la polizza Vita Protezione",
    "Invitare a un webinar informativo",
    "Proporre il pagamento rateale",
    "Segnalare un'offerta stagionale",
    "Proporre una consulenza previdenziale"
  ];
```
Aggiungere gli helper (vicino a `buildExercisePanel`):
```js
  function shuffleArr(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function pickDecoys(n, exclude) {
    const pool = DECOY_ACTIONS.filter(t => !exclude.includes(t));
    return shuffleArr(pool).slice(0, Math.max(0, n));
  }
  function getExerciseCards(it, key) {
    if (STATE.exerciseActions[key]) return STATE.exerciseActions[key];
    const reals = (it.nba || []).slice(0, 4).map((a, i) => ({
      text: reviseMessage(a.action_category, a.recommended_action) || a.recommended_action || "—",
      isReal: true, rank: i
    }));
    const decoys = pickDecoys(5 - reals.length, reals.map(r => r.text)).map(t => ({ text: t, isReal: false, rank: null }));
    const cards = shuffleArr(reals.concat(decoys));
    STATE.exerciseActions[key] = cards;
    return cards;
  }
  function renderExerciseOrder(container, key) {
    container.innerHTML = "";
    STATE.exerciseActions[key].forEach((c, idx) => {
      const row = el("div", {class:"exercise-card", draggable:"true"},
        el("span", {class:"exercise-card-grip msi"}, "drag_indicator"),
        el("span", {class:"exercise-card-rank"}, String(idx + 1)),
        el("span", {class:"exercise-card-text"}, c.text));
      row.addEventListener("dragstart", e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); row.classList.add("dragging"); });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", e => { e.preventDefault(); row.classList.add("drag-over"); });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", e => {
        e.preventDefault(); row.classList.remove("drag-over");
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(from) || from === idx) return;
        const arr = STATE.exerciseActions[key];
        const [moved] = arr.splice(from, 1); arr.splice(idx, 0, moved);
        renderExerciseOrder(container, key);
      });
      container.appendChild(row);
    });
  }
```

- [ ] **Step 3: Estendere buildExercisePanel (sezione ordina azioni)**

In `buildExercisePanel`, dopo `panel.appendChild(opts);` e **prima** di `reveal.addEventListener(...)`, aggiungere:
```js
    panel.appendChild(el("div", {class:"exercise-panel-sub"},
      "Ordina le azioni per priorità, dalla più alla meno prioritaria (alcune sono inventate)."));
    const actionsBox = el("div", {class:"exercise-actions"});
    getExerciseCards(it, key);
    renderExerciseOrder(actionsBox, key);
    panel.appendChild(actionsBox);
```
Cambiare il testo del bottone reveal da `" Rivela criticità"` a `" Rivela"` (rivela criticità + azioni). Lasciare `reveal.disabled = !guess` invariato.

- [ ] **Step 4: Estendere buildExerciseResult (verifica azioni)**

Sostituire `buildExerciseResult` con:
```js
  function buildExerciseResult(it) {
    const key = reviewKey(it);
    const guess = STATE.hypotheses[key];
    const actual = it.tier || STATE.lastResult?.priority_tier || null;
    const match = !!guess && guess === actual;
    const wrap = el("div", {class:"exercise-result-wrap"});
    // confronto criticità
    wrap.appendChild(el("div", {class:"exercise-result " + (match ? "ok" : "ko")},
      el("span", {class:"msi"}, match ? "check_circle" : "cancel"),
      el("span", {}, "La tua ipotesi: "), el("strong", {}, TIER_LABELS_IT[guess] || guess || "—"),
      el("span", {}, " — Reale: "), el("strong", {}, TIER_LABELS_IT[actual] || actual || "—")));
    // verifica azioni
    const cards = STATE.exerciseActions[key];
    if (cards && cards.length) {
      const realRanks = cards.filter(c => c.isReal).map(c => c.rank);
      const ordered = realRanks.length <= 1 || realRanks.every((r, i) => i === 0 || realRanks[i - 1] < r);
      wrap.appendChild(el("div", {class:"exercise-actions-verdict " + (ordered ? "ok" : "ko")},
        el("span", {class:"msi"}, ordered ? "check_circle" : "cancel"),
        el("span", {}, ordered ? "Ordine delle azioni reali: corretto" : "Ordine delle azioni reali: da rivedere")));
      const list = el("div", {class:"exercise-actions"});
      cards.forEach((c, i) => {
        list.appendChild(el("div", {class:"exercise-card reveal " + (c.isReal ? "real" : "decoy")},
          el("span", {class:"exercise-card-rank"}, String(i + 1)),
          el("span", {class:"exercise-card-text"}, c.text),
          el("span", {class:"exercise-card-tag"},
            el("span", {class:"msi"}, c.isReal ? "check_circle" : "cancel"),
            c.isReal ? ` Reale · priorità ${c.rank + 1}` : " Esca")));
      });
      wrap.appendChild(list);
    }
    return wrap;
  }
```

- [ ] **Step 5: Azzerare exerciseActions allo spegnimento del toggle**

Nel handler del `#exercise-toggle` (in `bindAll`), dove si fa `STATE.revealed = {}; STATE.hypotheses = {};`, aggiungere `STATE.exerciseActions = {};`.

- [ ] **Step 6: CSS (studio.css), nella sezione "Modalità esercizio"**
```css
.exercise-actions{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.exercise-card{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;cursor:grab}
.exercise-card .exercise-card-grip{color:var(--muted);font-size:18px}
.exercise-card .exercise-card-rank{flex:0 0 auto;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;background:var(--breeze);border-radius:999px;font-size:11px;font-weight:700;color:var(--ink2,#475569)}
.exercise-card .exercise-card-text{flex:1;color:var(--ink);line-height:1.4}
.exercise-card.dragging{opacity:.5}
.exercise-card.drag-over{border-color:var(--primary);box-shadow:0 0 0 2px var(--highlight)}
.exercise-card.reveal{cursor:default}
.exercise-card.reveal.real{border-color:#86EFAC;background:#F0FFF6}
.exercise-card.reveal.decoy{border-color:#FCA5A5;background:#FFF5F5}
.exercise-card-tag{flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;white-space:nowrap}
.exercise-card.reveal.real .exercise-card-tag{color:#166534}
.exercise-card.reveal.decoy .exercise-card-tag{color:#991b1b}
.exercise-card-tag .msi{font-size:15px}
.exercise-actions-verdict{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 12px;border-radius:8px;margin:10px 0 6px}
.exercise-actions-verdict.ok{background:#DCFCE7;color:#166534}
.exercise-actions-verdict.ko{background:#FEE2E2;color:#991b1b}
.exercise-actions-verdict .msi{font-size:18px}
.exercise-result-wrap{margin-bottom:14px;display:flex;flex-direction:column;gap:6px}
```

- [ ] **Step 7: Verifica**
```bash
node --check tangible_lab/static/studio.js && echo OK
```
Playwright (controller): in esercizio, aperto un record → 5 card ordinabili + 4 bottoni criticità; drag riordina; scelta criticità → "Rivela" attivo → reveal mostra banner criticità + lista azioni con ✓ reale (priorità N) / ✗ esca + verdetto ordine; sempre ≥1 esca; cambio record → nuovo set.

- [ ] **Step 8: Commit**
```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "feat(esercizio): ordina le azioni (reali+esche) con verifica vere/false e ordine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Self-Review
- Spec coverage: 5 card mix reali/esche (Step 2), drag&drop (Step 2 renderExerciseOrder), reveal vere/false+ordine (Step 4), unico esercizio (panel esteso Step 3 + result Step 4), reset (Step 5). ✓
- Type/contract: `it.nba` salvato (Step 1) e consumato da `getExerciseCards`; `reviseMessage`, `reviewKey`, `el` esistenti; `STATE.exerciseActions` inizializzato e azzerato. ✓
- Rischi: `it.nba` mancante → 0 reali → 5 esche (degrada, non rompe). Drag&drop desktop ok.
