# Motivazione del giudizio operatore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Quando si marca un giudizio Sbagliato/Da verificare, chiedere una motivazione obbligatoria (set diversi + "Altro" libero); mostrarla nell'UI e nell'export.

**Architecture:** Colonne `reason`/`reason_text` su `reviews` (migrazione additiva). Persistenza in models, validazione nell'endpoint PUT, colonne nell'export. UI: popover motivazione nella barra giudizio.

**Tech Stack:** Python (db/models/server, SQLite), JS vanilla (studio.js), CSS.

## Global Constraints
- Solo file del Lab: `tangible_lab/**` (db.py, models.py, server.py, static/). MAI file vendored.
- Italiano per copy/commenti. Working dir `/Users/luscarpa/Sites/NBA`, venv `.venv/bin/python`, branch `motivazione-giudizio`.
- Set motivazioni (l'ultima voce è sempre "Altro"):
  - **ko**: `Priorità errata`, `Azione non pertinente`, `Canale sbagliato`, `Tempistica sbagliata`, `Dato o trigger errato`, `Altro`
  - **unsure**: `Dato di base dubbio/incompleto`, `Caso limite / situazione ambigua`, `Manca contesto sul cliente`, `Plausibile, ma da confermare`, `Sospetto errore, da approfondire`, `Altro`
- Motivazione obbligatoria per ko/unsure; per "ok" nessuna (reason/reason_text = NULL).
- Commit con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: DB (schema + migrazione additiva) e models

**Files:** Modify `tangible_lab/db.py`, `tangible_lab/models.py`

**Interfaces prodotte:**
- `models.upsert_review(user_id, target_key, judgement, reason=None, reason_text=None) -> dict`
- query di lettura che includono `reason`, `reason_text`.

- [ ] **Step 1: Aggiungere le colonne al CREATE TABLE reviews**

In `tangible_lab/db.py`, nel `CREATE TABLE IF NOT EXISTS reviews`, aggiungere due colonne dopo `judgement`:

```python
    """CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_key TEXT NOT NULL,    -- 'predef:client:C001' | 'case:<id>'
        judgement TEXT NOT NULL,     -- 'ok' | 'ko' | 'unsure'
        reason TEXT,                 -- motivazione (label) per ko/unsure; NULL per ok
        reason_text TEXT,            -- testo libero quando reason = 'Altro'
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, target_key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",
```

- [ ] **Step 2: Helper di migrazione additiva + chiamarlo in init_db**

In `tangible_lab/db.py`, aggiungere un helper e invocarlo dentro `init_db()` dopo il loop `SCHEMA` (prima del bootstrap admin):

```python
def _ensure_columns(conn, table: str, columns: dict) -> None:
    """Aggiunge colonne mancanti a una tabella esistente (migrazione additiva idempotente)."""
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    for col, decl in columns.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
```

In `init_db()`, subito dopo `for stmt in SCHEMA: conn.execute(stmt)`:

```python
        # Migrazioni additive su DB esistenti
        _ensure_columns(conn, "reviews", {"reason": "TEXT", "reason_text": "TEXT"})
```

- [ ] **Step 3: `upsert_review` con reason**

In `tangible_lab/models.py`, sostituire `upsert_review` con:

```python
def upsert_review(user_id: int, target_key: str, judgement: str,
                  reason: Optional[str] = None, reason_text: Optional[str] = None) -> Dict[str, Any]:
    # Per "ok" non si conserva motivazione
    if judgement == "ok":
        reason, reason_text = None, None
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM reviews WHERE user_id = ? AND target_key = ?", (user_id, target_key)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE reviews SET judgement = ?, reason = ?, reason_text = ?, updated_at = datetime('now') WHERE id = ?",
                (judgement, reason, reason_text, existing["id"]),
            )
            rid = existing["id"]
        else:
            cur = conn.execute(
                "INSERT INTO reviews(user_id, target_key, judgement, reason, reason_text) VALUES (?, ?, ?, ?, ?)",
                (user_id, target_key, judgement, reason, reason_text),
            )
            rid = int(cur.lastrowid)
        row = conn.execute(
            "SELECT id, judgement, reason, reason_text, created_at, updated_at FROM reviews WHERE id = ?", (rid,)
        ).fetchone()
        return dict(row)
```

> Nota: la vecchia `SELECT` finale di `upsert_review` selezionava solo `id, judgement, created_at, updated_at`; ora include `reason, reason_text`. Mantenere il resto del corpo come sopra.

- [ ] **Step 4: Includere reason nelle query di lettura**

In `tangible_lab/models.py`, aggiornare le `SELECT`:
- `get_user_review`: `SELECT id, judgement, reason, reason_text, created_at, updated_at FROM reviews WHERE ...`
- `list_all_user_reviews`: `SELECT target_key, judgement, reason, reason_text, updated_at FROM reviews WHERE user_id = ?`
- `list_reviews_for_target`: aggiungere `r.reason, r.reason_text` alla lista dei campi.
- `list_all_reviews_export`: `SELECT r.id, r.target_key, u.username, r.judgement, r.reason, r.reason_text, r.created_at, r.updated_at FROM reviews r JOIN users u ON u.id = r.user_id ORDER BY r.updated_at DESC`

- [ ] **Step 5: Verifica Python**

```bash
cd /Users/luscarpa/Sites/NBA && .venv/bin/python - <<'PY'
import os, tempfile
os.environ["TANGIBLE_LAB_DATA_DIR"] = tempfile.mkdtemp()
os.environ["TANGIBLE_LAB_SINGLE_USER"] = "1"
from tangible_lab import db, models
db.init_db()
# idempotenza migrazione
db.init_db()
uid = 1
# ko con motivazione
r = models.upsert_review(uid, "predef:client:X", "ko", "Azione non pertinente", None)
assert r["reason"] == "Azione non pertinente", r
# update a ok azzera la motivazione
r = models.upsert_review(uid, "predef:client:X", "ok", "ignorata", "ignorata")
assert r["reason"] is None and r["reason_text"] is None, r
# Altro con testo
r = models.upsert_review(uid, "predef:client:Y", "unsure", "Altro", "serve verifica X")
assert r["reason"] == "Altro" and r["reason_text"] == "serve verifica X", r
rows = models.list_all_reviews_export()
assert all("reason" in x for x in rows)
print("OK Task 1")
PY
```
Expected: `OK Task 1` senza assert error.

- [ ] **Step 6: Commit**
```bash
git add tangible_lab/db.py tangible_lab/models.py
git commit -m "feat(giudizio): colonne reason/reason_text su reviews + migrazione e upsert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API (validazione) + export

**Files:** Modify `tangible_lab/server.py`

**Interfaces consumate:** `models.upsert_review(..., reason, reason_text)`, `models.list_all_reviews_export()` (con reason).

- [ ] **Step 1: Validazione e passaggio reason nell'endpoint PUT**

In `tangible_lab/server.py`, sostituire il corpo di `api_set_review` (endpoint `PUT /lab/api/reviews/{target_key:path}`):

```python
@app.put("/lab/api/reviews/{target_key:path}", include_in_schema=False)
def api_set_review(target_key: str, request: Request, payload: dict = Body(...)):
    u = require_user(request)
    judgement = payload.get("judgement")
    if judgement is None:
        models.delete_review(u["id"], target_key)
        return {"ok": True}
    if judgement not in ("ok", "ko", "unsure"):
        raise HTTPException(status_code=400, detail="judgement deve essere ok|ko|unsure")
    reason = (payload.get("reason") or "").strip() or None
    reason_text = (payload.get("reason_text") or "").strip() or None
    if judgement in ("ko", "unsure"):
        if not reason:
            raise HTTPException(status_code=400, detail="Motivazione obbligatoria per ko/unsure")
        if reason.lower() == "altro" and not reason_text:
            raise HTTPException(status_code=400, detail="Per 'Altro' serve il testo della motivazione")
    return models.upsert_review(u["id"], target_key, judgement, reason, reason_text)
```

> Nota: il ramo `judgement is None` (delete_review + `return {"ok": True}`) è preservato identico all'originale; si aggiunge solo la lettura/validazione di reason e il passaggio a `upsert_review`.

- [ ] **Step 2: Mappa target→motivazione + colonna nel foglio "Stato per anagrafica"**

In `tangible_lab/server.py`, nella funzione di export, **prima** del loop che costruisce `rows_for_target`, costruire una mappa target→motivazione dai dati già disponibili:

```python
    # motivazione per target (single-user: una review per target; in multi prende la più recente)
    reason_by_target = {}
    for r in models.list_all_reviews_export():
        if r["target_key"] not in reason_by_target:
            txt = r.get("reason") or ""
            if txt and (r.get("reason_text")):
                txt = f'{txt} — {r["reason_text"]}'
            reason_by_target[r["target_key"]] = txt
```

Aggiungere `"motivazione"` all'header del foglio "Stato per anagrafica" (dopo `"da_verificare"`):

```python
    ws2.append([
        "target_key", "kind", "tipo", "record_id", "tier", "score", "strategy",
        "primary_action", "n_giudizi", "corretti", "sbagliati", "da_verificare",
        "motivazione", "n_commenti", "ultimo_giudizio"
    ])
```

E nella riga `rows_for_target.append([...])` inserire `reason_by_target.get(key, "")` nella stessa posizione (dopo `st["unsure"]`, prima di `st["comments"]`):

```python
        rows_for_target.append([
            key, kind, rec_type, rec_id, tier, score, strategy, primary,
            n_giudizi, st["ok"], st["ko"], st["unsure"],
            reason_by_target.get(key, ""),
            st["comments"], st["last_review_at"]
        ])
```

Aggiornare anche la lista `widths` aggiungendo una larghezza (es. `30`) nella posizione della nuova colonna (12ª): da `[22, 8, 8, 10, 10, 8, 14, 60, 10, 9, 10, 13, 11, 22]` a `[22, 8, 8, 10, 10, 8, 14, 60, 10, 9, 10, 13, 30, 11, 22]`.

- [ ] **Step 3: Colonne motivazione nel foglio "Giudizi"**

Header del foglio "Giudizi": aggiungere `"motivazione", "dettaglio"` dopo `"giudizio"`:

```python
    ws3.append(["id", "utente", "target_key", "kind", "tipo", "record_id",
                "giudizio", "motivazione", "dettaglio", "creato", "aggiornato"])
```

Nella riga append del loop:

```python
        ws3.append([r["id"], r["username"], r["target_key"], kind, rec_type, rec_id,
                    r["judgement"], r.get("reason") or "", r.get("reason_text") or "",
                    r["created_at"], r["updated_at"]])
```

Aggiornare la lista delle larghezze del foglio Giudizi aggiungendo due valori (es. `28, 30`) nelle nuove posizioni: da `[7, 16, 24, 9, 9, 12, 13, 22, 22]` a `[7, 16, 24, 9, 9, 12, 13, 28, 30, 22, 22]`.

(Il foglio "Note" resta invariato e ultimo: nessuna modifica.)

- [ ] **Step 4: Verifica**

```bash
cd /Users/luscarpa/Sites/NBA && .venv/bin/python -c "import tangible_lab.server; print('import server OK')"
```
Expected: `import server OK`. Verifica funzionale dell'export (con dati reali) la fa il controller.

- [ ] **Step 5: Commit**
```bash
git add tangible_lab/server.py
git commit -m "feat(giudizio): validazione motivazione obbligatoria + motivazione nell'export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend — popover motivazione + chip (studio.js, studio.css)

**Files:** Modify `tangible_lab/static/studio.js`, `tangible_lab/static/studio.css`

**Interfaces consumate:** `setReview` (esteso), `STATE.reviews`, `getReview`, `REVIEW_META`, `el`, `$`.

- [ ] **Step 1: Set motivazioni + estendere setReview**

In `studio.js`, vicino a `REVIEW_META`, aggiungere:

```js
  const REVIEW_REASONS = {
    ko: ["Priorità errata", "Azione non pertinente", "Canale sbagliato", "Tempistica sbagliata", "Dato o trigger errato", "Altro"],
    unsure: ["Dato di base dubbio/incompleto", "Caso limite / situazione ambigua", "Manca contesto sul cliente", "Plausibile, ma da confermare", "Sospetto errore, da approfondire", "Altro"]
  };
```

Estendere `setReview` per inviare reason/reason_text e salvarli in STATE:

```js
  async function setReview(it, judgement, reason = null, reason_text = null) {
    if (!it) return;
    const k = reviewKey(it);
    try {
      await fetchJSON(`/lab/api/reviews/${encodeURIComponent(k)}`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ judgement, reason, reason_text })
      });
      if (judgement == null) delete STATE.reviews[k];
      else STATE.reviews[k] = { judgement, reason, reason_text, reviewedAt: new Date().toISOString() };
    } catch (e) { toast("Errore salvataggio giudizio: " + e.message, "err"); }
  }
```

> Verificare la firma originale di `setReview` (era `setReview(it, judgement)`); i chiamanti esistenti passano 2 argomenti → restano validi (reason/reason_text default null).

- [ ] **Step 2: `loadReviewsFromAPI` popola reason**

In `loadReviewsFromAPI`, dove costruisce `STATE.reviews[r.target_key]`, includere reason:

```js
      rows.forEach(r => { STATE.reviews[r.target_key] = { judgement: r.judgement, reason: r.reason, reason_text: r.reason_text, reviewedAt: r.updated_at }; });
```

- [ ] **Step 3: Popover motivazione in buildReviewBar**

In `studio.js`, sostituire la creazione dei bottoni giudizio dentro `buildReviewBar` in modo che ko/unsure aprano il popover. Sostituire il blocco `["ok","ko","unsure"].map(...)` con:

```js
      ["ok","ko","unsure"].map(j => {
        const m = REVIEW_META[j];
        const active = current?.judgement === j;
        const b = el("button", {class:"review-btn" + (active ? " active " + j : ""), "data-j":j, title:m.lbl},
          el("span", {class:"msi"}, m.icon), " " + m.lbl);
        b.addEventListener("click", async () => {
          if (j === "ok") {
            if (active) { await setReview(it, null); } else { await setReview(it, "ok"); }
            afterReviewChange(it, bar);
            return;
          }
          // ko / unsure → popover motivazione (nuovo o in modifica)
          openReasonPopover(b, it, j, active ? current : null, bar);
        });
        return b;
      })
```

Dopo `if (current) { ... review-bar-right ... }`, se il giudizio corrente è ko/unsure ed ha una motivazione, aggiungere un chip cliccabile. Subito prima di `bar.appendChild(buildCommentsThread(it));` inserire:

```js
    if (current && (current.judgement === "ko" || current.judgement === "unsure") && current.reason) {
      const label = current.reason === "Altro" && current.reason_text ? `Altro: ${current.reason_text}` : current.reason;
      const chip = el("button", {class:"review-reason-chip", type:"button", title:"Modifica motivazione"},
        el("span", {class:"msi"}, "edit_note"), " " + label);
      chip.addEventListener("click", () => {
        const btn = bar.querySelector(`.review-btn[data-j="${current.judgement}"]`);
        openReasonPopover(btn || chip, it, current.judgement, current, bar);
      });
      bar.appendChild(chip);
    }
```

- [ ] **Step 4: Funzioni `openReasonPopover` e `afterReviewChange`**

Aggiungere in `studio.js` (vicino a `buildReviewBar`):

```js
  function afterReviewChange(it, bar) {
    STATE.items = buildItems(); updateFolderCounts(); renderListPane();
    const newBar = buildReviewBar(it);
    if (bar && bar.parentNode) bar.parentNode.replaceChild(newBar, bar);
  }

  function openReasonPopover(anchorBtn, it, judgement, current, bar) {
    document.querySelectorAll(".reason-popover").forEach(n => n.remove());
    const reasons = REVIEW_REASONS[judgement] || [];
    const meta = REVIEW_META[judgement];
    let selected = current?.reason || null;
    let otherText = current?.reason_text || "";

    const pop = el("div", {class:"reason-popover"});
    pop.appendChild(el("div", {class:"reason-popover-title"}, "Motivazione — " + meta.lbl));
    const otherInput = el("input", {type:"text", class:"reason-other-input", placeholder:"Specifica…", value: otherText});
    const otherWrap = el("div", {class:"reason-other-wrap"}, otherInput);
    otherWrap.style.display = (selected === "Altro") ? "block" : "none";

    const confirm = el("button", {class:"btn primary-cta", type:"button"}, "Conferma");
    const validate = () => {
      const ok = !!selected && (selected !== "Altro" || otherInput.value.trim().length > 0);
      confirm.disabled = !ok;
    };
    reasons.forEach(r => {
      const id = "rsn-" + Math.abs(hashStr(r));
      const radio = el("input", {type:"radio", name:"reason", id, value:r});
      if (selected === r) radio.checked = true;
      radio.addEventListener("change", () => {
        selected = r;
        otherWrap.style.display = (r === "Altro") ? "block" : "none";
        if (r === "Altro") otherInput.focus();
        validate();
      });
      pop.appendChild(el("label", {class:"reason-opt", for:id}, radio, el("span", {}, r)));
    });
    pop.appendChild(otherWrap);
    otherInput.addEventListener("input", validate);

    confirm.addEventListener("click", async () => {
      await setReview(it, judgement, selected, selected === "Altro" ? otherInput.value.trim() : null);
      pop.remove();
      afterReviewChange(it, bar);
      toast(`Marcato come "${meta.lbl}"`, "ok");
    });
    const cancel = el("button", {class:"btn ghost", type:"button"}, "Annulla");
    cancel.addEventListener("click", () => pop.remove());
    const remove = current ? el("button", {class:"reason-remove", type:"button"}, "Rimuovi giudizio") : null;
    if (remove) remove.addEventListener("click", async () => {
      await setReview(it, null);
      pop.remove();
      afterReviewChange(it, bar);
      toast("Giudizio rimosso", "ok");
    });
    pop.appendChild(el("div", {class:"reason-popover-foot"}, remove, el("div", {class:"reason-popover-btns"}, cancel, confirm)));

    validate();
    document.body.appendChild(pop);
    // posiziona sotto il bottone àncora
    const r = anchorBtn.getBoundingClientRect();
    const pw = pop.offsetWidth || 280;
    let left = Math.min(r.left, window.innerWidth - pw - 12);
    pop.style.left = Math.max(12, left) + "px";
    pop.style.top = (r.bottom + 6) + "px";
    const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== anchorBtn) { pop.remove(); document.removeEventListener("mousedown", onDoc); } };
    setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
  }
```

Se non esiste già un helper `hashStr`, aggiungerlo vicino agli utils:

```js
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }
```

> Le precedenti chiamate inline nel click handler di ko/unsure che facevano `setReview` + `buildItems` + replace bar vanno rimosse: ora quel flusso passa da `openReasonPopover`/`afterReviewChange`. Verificare che non resti codice duplicato del vecchio handler.

- [ ] **Step 5: CSS popover motivazione + chip**

In `studio.css` (vicino a `.filter-popover`), aggiungere:

```css
.reason-popover{position:fixed;z-index:1101;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 40px rgba(15,17,32,.18);padding:12px;width:280px;max-width:calc(100vw - 24px);display:flex;flex-direction:column;gap:6px}
.reason-popover-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.reason-opt{display:flex;align-items:center;gap:8px;padding:6px 6px;border-radius:6px;cursor:pointer;font-size:13px}
.reason-opt:hover{background:var(--breeze)}
.reason-opt input{margin:0;cursor:pointer}
.reason-other-wrap{padding:2px 6px 6px}
.reason-other-input{width:100%;font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--border);border-radius:8px}
.reason-popover-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
.reason-popover-btns{display:flex;gap:8px}
.reason-popover-btns .btn{font-size:12px;padding:7px 12px}
.reason-remove{background:transparent;border:none;color:#dc2626;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.review-reason-chip{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid var(--border);border-radius:999px;padding:4px 10px;font:inherit;font-size:11px;font-weight:600;color:var(--ink2,#475569);cursor:pointer}
.review-reason-chip:hover{border-color:var(--primary);color:var(--primary)}
.review-reason-chip .msi{font-size:14px}
```

- [ ] **Step 6: Verifica**

```bash
node --check tangible_lab/static/studio.js && echo OK
```
Poi verifica Playwright (la fa il controller): click "Sbagliato" → popover set ko; "Altro" mostra il testo; "Conferma" disabilitato finché non valido; chip motivazione mostrato; persistenza dopo reload; "Corretto" nessun popover.

- [ ] **Step 7: Commit**
```bash
git add tangible_lab/static/studio.js tangible_lab/static/studio.css
git commit -m "feat(giudizio): popover motivazione obbligatoria per ko/unsure + chip in barra

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review
- **Spec coverage**: colonne+migrazione (T1), validazione obbligatoria+export (T2), popover/chip set diversi (T3). ✓
- **Type/contract**: `upsert_review(...,reason,reason_text)` coerente tra models/server; `setReview(it,judgement,reason,reason_text)` coerente coi chiamanti (default null); `STATE.reviews[k]` include reason/reason_text usati dal chip. ✓
- **Placeholder scan**: codice completo per ogni step; le note "verificare nel codice reale" riguardano la conferma di righe preesistenti, non logica nuova. ✓
- **Rischi**: il vecchio handler inline di ko/unsure va rimosso (Step 4 nota) per non duplicare il salvataggio; la verifica Playwright del controller copre il flusso completo.
