/* Tangible Lab — Check-up Vittoria simulator. */
(() => {
  "use strict";

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const el = (tag, attrs={}, ...children) => {
    const e = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k === "innerHTML") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    const app = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(app); return; }
      if (typeof c === "string" || typeof c === "number") { e.appendChild(document.createTextNode(String(c))); return; }
      e.appendChild(c);
    };
    children.forEach(app);
    return e;
  };
  const toast = (m, k="") => { const t = $("#toast"); t.textContent = m; t.className = "toast show " + k; setTimeout(()=>{t.className = "toast " + k;}, 2400); };
  const fetchJSON = async (url, opts={}) => {
    const r = await fetch(url, {credentials:"include", ...opts});
    if (r.status === 401) { location.href = "/lab/login.html"; throw new Error("Not authenticated"); }
    if (!r.ok) {
      let e=""; try{ const j=await r.json(); e=typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || j); }catch{ e=r.statusText; }
      throw new Error(`${r.status}: ${e}`);
    }
    return r.json();
  };

  const STATE = {
    me: null,
    data: null,       // { needs:[...], questions:[...] }
    answers: {},      // { qid: aid | [aid,...] }
    result: null,
    selectedCase: null,
    cases: [],
    sideTab: "mine",
    sideQuery: ""
  };

  const LEVEL_META = {
    alto:  { lbl:"Alto",  ico:"priority_high", bg:"#FCE3E9", color:"#991b1b", border:"#F7B9CB" },
    medio: { lbl:"Medio", ico:"warning",       bg:"#FFF4DC", color:"#92580A", border:"#F59E0B" },
    basso: { lbl:"Basso", ico:"info",          bg:"#E6FCF8", color:"#007D6F", border:"#00E0CA" }
  };
  const NEED_ICONS = {
    casa:             "home",
    infortuni:        "healing",
    malattia:         "medical_services",
    previdenza:       "elderly",
    animali:          "pets",
    micromobilita:    "directions_bike",
    rc_privata:       "person",
    tutela_legale:    "gavel",
    vita_protezione:  "favorite",
    rc_professionale: "work",
    viaggi:           "flight"
  };

  async function init() {
    try { STATE.me = await fetchJSON("/lab/api/me"); }
    catch { return; }

    try {
      STATE.data = await fetchJSON("/lab/api/checkup/data");
      renderForm();
      await refreshCases();
      bindUI();
    } catch (e) {
      $("#cu-form").innerHTML = `<div class="ml-not-run">Errore caricamento dati: ${e.message}</div>`;
    }
  }

  function bindUI() {
    $("#cu-compute").addEventListener("click", computeAndRender);
    $("#cu-reset").addEventListener("click", () => {
      if (!confirm("Cancellare tutte le risposte e ricominciare da zero?")) return;
      STATE.answers = {};
      STATE.result = null;
      STATE.selectedCase = null;
      $("#cu-name").value = "";
      renderForm();
      renderResult();
      renderCasesSidebar();
    });
    $("#cu-save").addEventListener("click", saveCase);
    $("#cu-new").addEventListener("click", () => {
      STATE.answers = {};
      STATE.result = null;
      STATE.selectedCase = null;
      $("#cu-name").value = "";
      renderForm();
      renderResult();
      renderCasesSidebar();
    });
    $("#cu-search").addEventListener("input", e => { STATE.sideQuery = e.target.value.trim(); renderCasesSidebar(); });
    $$('.side-tabs button').forEach(b => b.addEventListener("click", () => {
      STATE.sideTab = b.dataset.tab;
      $$('.side-tabs button').forEach(x => x.classList.toggle("active", x === b));
      renderCasesSidebar();
    }));
  }

  // ----- Form questionario -----
  function renderForm() {
    const root = $("#cu-form");
    root.innerHTML = "";
    root.appendChild(buildLegend());
    STATE.data.questions.forEach((q, idx) => {
      root.appendChild(buildQuestionCard(q, idx + 1));
    });
  }

  function buildLegend() {
    // Legenda compatta: icona + livello + descrizione dei bisogni
    const wrap = el("div", {class:"cu-legend"});
    wrap.appendChild(el("div", {class:"cu-legend-title"},
      el("span", {class:"msi"}, "info"),
      " Accanto a ogni risposta vedi i bisogni che spinge:"
    ));
    const levels = el("div", {class:"cu-legend-row"},
      el("span", {class:"cu-legend-item alto"}, el("span", {class:"need-tag alto"}, el("span", {class:"msi"}, "circle")), " alto"),
      el("span", {class:"cu-legend-item medio"}, el("span", {class:"need-tag medio"}, el("span", {class:"msi"}, "circle")), " medio"),
      el("span", {class:"cu-legend-item basso"}, el("span", {class:"need-tag basso"}, el("span", {class:"msi"}, "circle")), " basso")
    );
    wrap.appendChild(levels);
    // Mappa icona→bisogno (mostra cosa significa ciascuna icona Material)
    const map = el("div", {class:"cu-legend-needs"});
    STATE.data.needs.forEach(n => {
      map.appendChild(el("span", {class:"cu-legend-need", title:n.label},
        el("span", {class:"msi"}, NEED_ICONS[n.id] || "circle"),
        " ", n.label
      ));
    });
    wrap.appendChild(map);
    return wrap;
  }
  function buildQuestionCard(q, num) {
    const card = el("div", {class:"q-card", "data-qid": q.id});
    card.appendChild(el("div", {class:"q-head"},
      el("span", {class:"q-num"}, String(num)),
      el("div", {class:"q-text"}, q.text),
      el("span", {class:"q-type"}, q.type === "multi" ? "multipla" : (q.type === "boolean" ? "sì/no" : "scelta unica"))
    ));
    const opts = el("div", {class:"q-options" + (q.type === "boolean" ? " bool" : "")});
    q.answers.forEach(a => {
      const checked = isAnswerChecked(q, a);
      const inputType = q.type === "multi" ? "checkbox" : "radio";
      const id = `q_${q.id}__${a.id}`;
      const lbl = el("label", {class:"q-opt" + (checked ? " on" : ""), for:id, "data-aid":a.id},
        el("input", {type:inputType, name:`q_${q.id}`, id, value:a.id, ...(checked ? {checked: true} : {})}),
        el("span", {class:"q-opt-lbl"}, a.text),
        a.needs ? el("span", {class:"q-opt-needs"},
          ...Object.entries(a.needs).map(([k,lv]) =>
            el("span", {class:`need-tag ${lv}`, title:`${needLabel(k)}: ${lv}`},
              el("span", {class:"msi"}, NEED_ICONS[k] || "circle")
            )
          )
        ) : null
      );
      lbl.addEventListener("change", () => onAnswerChange(q, a, lbl.querySelector("input").checked));
      opts.appendChild(lbl);
    });
    card.appendChild(opts);
    return card;
  }
  function isAnswerChecked(q, a) {
    const v = STATE.answers[q.id];
    if (v == null) return false;
    if (Array.isArray(v)) return v.includes(a.id);
    return v === a.id;
  }
  function onAnswerChange(q, a, checked) {
    if (q.type === "multi") {
      const list = Array.isArray(STATE.answers[q.id]) ? STATE.answers[q.id] : [];
      const set = new Set(list);
      if (checked) set.add(a.id); else set.delete(a.id);
      STATE.answers[q.id] = [...set];
    } else {
      STATE.answers[q.id] = a.id;
    }
    // sync visual state
    const card = document.querySelector(`.q-card[data-qid="${q.id}"]`);
    card?.querySelectorAll(".q-opt").forEach(l => {
      const aid = l.dataset.aid;
      const inp = l.querySelector("input");
      l.classList.toggle("on", inp.checked);
    });
  }
  function needLabel(slug) {
    const n = (STATE.data.needs || []).find(x => x.id === slug);
    return n ? n.label : slug;
  }

  // ----- Compute & result -----
  async function computeAndRender() {
    const btn = $("#cu-compute"); btn.disabled = true;
    try {
      STATE.result = await fetchJSON("/lab/api/checkup/compute", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({answers: STATE.answers})
      });
      renderResult();
      toast(`Calcolato: ${Object.keys(STATE.result.levels || {}).length} bisogni rilevati`, "ok");
      // scroll su mobile al risultato
      if (window.innerWidth < 1000) $("#cu-result")?.scrollIntoView({behavior:"smooth", block:"start"});
    } catch (e) { toast(e.message, "err"); }
    finally { btn.disabled = false; }
  }

  function renderResult() {
    const box = $("#cu-result");
    box.innerHTML = "";
    if (!STATE.result) {
      box.innerHTML = `
        <div class="checkup-result-empty">
          <span class="msi">healing</span>
          <div class="t">Compila il questionario e premi <strong>Calcola</strong></div>
          <div class="s">I bisogni assicurativi rilevati appariranno qui con il livello di priorità.</div>
        </div>`;
      return;
    }
    const { levels = {}, contributions = [], answers_count = 0 } = STATE.result;
    const orderedNeeds = STATE.data.needs.map(n => ({...n, level: levels[n.id] || null}));
    const detected = orderedNeeds.filter(n => n.level);
    const notDetected = orderedNeeds.filter(n => !n.level);

    box.appendChild(el("div", {class:"checkup-result-head"},
      el("div", {class:"crh-title"},
        el("span", {class:"msi"}, "analytics"),
        " Risultato"
      ),
      el("div", {class:"crh-meta"},
        `${answers_count} risposte · ${detected.length}/${orderedNeeds.length} bisogni rilevati`
      )
    ));

    // bisogni rilevati ordinati per livello
    const rank = {alto:3, medio:2, basso:1};
    detected.sort((a,b) => (rank[b.level]||0) - (rank[a.level]||0));

    const list = el("div", {class:"need-list"});
    detected.forEach(n => list.appendChild(needCard(n, contributions)));
    if (!detected.length) {
      list.appendChild(el("div", {class:"ml-not-run"}, "Nessun bisogno rilevato. Prova ad aggiungere altre risposte."));
    }
    box.appendChild(list);

    if (notDetected.length) {
      const acc = el("details", {class:"acc", style:{marginTop:"10px"}},
        el("summary", {}, el("span", {class:"msi"}, "visibility_off"), ` Non rilevati (${notDetected.length})`),
        el("div", {class:"body"},
          ...notDetected.map(n => el("div", {class:"need-card muted-card"},
            el("span", {class:"msi need-ico"}, NEED_ICONS[n.id] || "circle"),
            el("span", {class:"need-name"}, n.label),
            el("span", {class:"muted", style:{fontSize:"11px"}}, "—")
          ))
        )
      );
      box.appendChild(acc);
    }
  }

  function needCard(n, contributions) {
    const m = LEVEL_META[n.level];
    const contribs = contributions.filter(c => c.needs[n.id]);
    const card = el("div", {class:`need-card lvl-${n.level}`});
    card.appendChild(el("span", {class:"msi need-ico", style:{color:m.color}}, NEED_ICONS[n.id] || "circle"));
    card.appendChild(el("div", {class:"need-body"},
      el("div", {class:"need-name"}, n.label),
      el("div", {class:"need-meta"}, `${contribs.length} risposta${contribs.length > 1 ? "e" : ""} hanno contribuito`)
    ));
    card.appendChild(el("span", {class:`level-badge ${n.level}`}, el("span", {class:"msi"}, m.ico), " ", m.lbl));

    // dettaglio "perché"
    if (contribs.length) {
      const det = el("details", {class:"acc need-why"},
        el("summary", {}, "Perché?"),
        el("div", {class:"body"},
          ...contribs.map(c => {
            const q = STATE.data.questions.find(x => x.id === c.question_id);
            const a = q?.answers.find(x => x.id === c.answer_id);
            if (!q || !a) return null;
            return el("div", {class:"why-row"},
              el("span", {class:"why-q"}, q.text),
              el("span", {}, "→"),
              el("span", {class:"why-a"}, a.text),
              el("span", {class:`level-pill ${c.needs[n.id]}`}, c.needs[n.id])
            );
          })
        )
      );
      card.appendChild(det);
    }
    return card;
  }

  // ----- Casi salvati -----
  async function refreshCases() {
    try { STATE.cases = await fetchJSON("/lab/api/checkup/cases"); }
    catch { STATE.cases = []; }
    renderCasesSidebar();
  }
  function renderCasesSidebar() {
    const box = $("#cu-list");
    const q = STATE.sideQuery.toLowerCase();
    const list = STATE.cases.filter(c => {
      if (STATE.sideTab === "mine") {
        if (c.owner_id !== STATE.me.id) return false;
      } else {
        if (!c.shared || c.owner_id === STATE.me.id) return false;
      }
      return !q || c.name.toLowerCase().includes(q);
    }).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    box.innerHTML = "";
    if (!list.length) {
      box.appendChild(el("div", {class:"muted", style:{padding:"14px", textAlign:"center", fontSize:"12px"}},
        STATE.sideTab === "mine" ? "Nessun caso salvato ancora." : "Nessun caso condiviso dal team."));
      return;
    }
    list.forEach(c => {
      const lvls = c.result?.levels || {};
      const counts = Object.values(lvls).reduce((acc, l) => { acc[l] = (acc[l]||0)+1; return acc; }, {});
      const isActive = STATE.selectedCase?.id === c.id;
      const item = el("div", {class:"checkup-case-item" + (isActive ? " active" : "")},
        el("div", {class:"cci-name"}, c.name),
        el("div", {class:"cci-meta"},
          c.owner_id !== STATE.me.id ? el("span", {class:"chip"}, c.owner_username) : null,
          counts.alto  ? el("span", {class:"level-pill alto"},  counts.alto + " alti")    : null,
          counts.medio ? el("span", {class:"level-pill medio"}, counts.medio + " medi")   : null,
          counts.basso ? el("span", {class:"level-pill basso"}, counts.basso + " bassi") : null
        )
      );
      item.addEventListener("click", () => loadCase(c));
      box.appendChild(item);
    });
  }
  function loadCase(c) {
    STATE.selectedCase = c;
    STATE.answers = JSON.parse(JSON.stringify(c.answers || {}));
    STATE.result = c.result || null;
    $("#cu-name").value = c.name || "";
    renderForm();
    renderResult();
    renderCasesSidebar();
  }
  async function saveCase() {
    const name = $("#cu-name").value.trim();
    if (!name) { toast("Dai un nome allo scenario prima di salvare", "err"); return; }
    if (!STATE.result) { toast("Prima esegui 'Calcola' per generare il risultato", "err"); return; }
    const shared = confirm("Vuoi condividere questo caso con il team?\n\nOK = sì · Annulla = privato");
    try {
      const body = { name, answers: STATE.answers, shared };
      if (STATE.selectedCase) {
        STATE.selectedCase = await fetchJSON(`/lab/api/checkup/cases/${STATE.selectedCase.id}`, {
          method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
        });
        toast(`"${name}" aggiornato`, "ok");
      } else {
        STATE.selectedCase = await fetchJSON("/lab/api/checkup/cases", {
          method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
        });
        toast(`Caso "${name}" salvato`, "ok");
      }
      await refreshCases();
    } catch (e) { toast(e.message, "err"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
