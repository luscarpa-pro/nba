/* NBA Studio — area di test stile mail-client (Outlook 3-pane).
   Sidebar = folder smart (per tier, tipo, salvati).
   Centro  = lista anagrafiche tipo email (badge tier, ID, sintesi, score).
   Destra  = detail con Perché + Azioni + Modifica record (form accordion) + A/B inline.
   Niente modifiche all'algoritmo: usa solo gli endpoint esistenti.
*/
(() => {
  "use strict";

  // ============================== schemas ==============================
  const CLIENT_SCHEMA = { sections: [
    { title: "Identificazione", icon:"badge", fields: [
      { k:"client_id", label:"Client ID", type:"text", req:true },
      { k:"email", label:"Email", type:"text", nullable:true },
      { k:"phone", label:"Telefono", type:"text", nullable:true },
      { k:"preferred_channel", label:"Canale preferito", type:"select", opts:["", "PHONE","EMAIL","SMS","WHATSAPP"], nullable:true },
      { k:"whatsapp_enabled", label:"WhatsApp abilitato", type:"tristate" }
    ]},
    { title: "Stato relazione", icon:"event_note", fields: [
      { k:"last_contact_days", label:"Ultimo contatto (gg fa)", type:"number", nullable:true, help:"vuoto = mai contattato" },
      { k:"birthday_days", label:"Compleanno tra (gg)", type:"number", nullable:true },
      { k:"anniversary_days", label:"Anniversario tra (gg)", type:"number", nullable:true },
      { k:"customer_tenure_years", label:"Anzianità (anni)", type:"number", step:0.1, nullable:true },
      { k:"active_policies_count", label:"# polizze attive", type:"number", nullable:true },
      { k:"checkup_done", label:"Checkup eseguito", type:"tristate" }
    ]},
    { title: "VIVA Points", icon:"loyalty", fields: [
      { k:"viva_enrolled", label:"Iscritto VIVA", type:"tristate" },
      { k:"viva_points", label:"Saldo punti", type:"number", nullable:true },
      { k:"viva_points_expiring", label:"Punti in scadenza", type:"number", nullable:true }
    ]},
    { title: "Insoluti & opportunità", icon:"payments", fields: [
      { k:"unpaid_days", label:"Giorni di insoluto (lista, virgole)", type:"numArray" },
      { k:"cross_sell_gaps", label:"Gap di copertura (legacy/fallback)", type:"enumArray",
        help:"Per i record reali è derivato da insurance_needs; usato solo se quel campo è assente",
        hideIf: d => Array.isArray(d && d.insurance_needs) && d.insurance_needs.length > 0,
        opts:["CASA","INFORTUNI","MALATTIA","VITA_PROTEZIONE","PREVIDENZA_COMPLEMENTARE","RESPONSABILITA_PROFESSIONALE","VITA_PRIVATA_RESPONSABILITA_CIVILE","VITA_PRIVATA_ANIMALI_DOMESTICI","VITA_PRIVATA_TUTELA_LEGALE","VITA_PRIVATA_MICROMOBILITA","VITA_PRIVATA_VIAGGI"] }
    ]},
    { title: "Polizze", icon:"shield", arrayKey:"policies", itemTitle:"Polizza", itemFields:[
      { k:"policy_number", label:"Numero", type:"text" },
      { k:"product", label:"Prodotto (ramo)", type:"select", opts:["AUTO","VITA","R.E.","CAUZIONI / CREDITO","RAMI TRASPORTI"] },
      { k:"premium", label:"Premio €", type:"number" },
      { k:"expiry_date", label:"Scadenza", type:"date" },
      { k:"churn_rate", label:"Churn rate (0-1)", type:"number", step:0.01, nullable:true }
    ]},
    { title: "Sinistri", icon:"gavel", arrayKey:"claims", itemTitle:"Sinistro", itemFields:[
      { k:"status", label:"Stato", type:"select", opts:["OPEN","IN_PROGRESS","CLOSED"] },
      { k:"opened_date", label:"Data apertura", type:"date" },
      { k:"reference_id", label:"Riferimento", type:"text" }
    ]},
    { title: "Reclami", icon:"feedback", arrayKey:"complaints", itemTitle:"Reclamo", itemFields:[
      { k:"status", label:"Stato", type:"select", opts:["OPEN","IN_PROGRESS","CLOSED"] },
      { k:"opened_date", label:"Data apertura", type:"date" },
      { k:"reference_id", label:"Riferimento", type:"text" }
    ]},
    { title: "Campagne attive", icon:"campaign", arrayKey:"active_campaigns", itemTitle:"Campagna", itemFields:[
      { k:"campaign_id", label:"ID campagna", type:"text" },
      { k:"name", label:"Nome", type:"text" },
      { k:"product_scope", label:"Prodotto (ramo)", type:"select", opts:["AUTO","VITA","R.E.","CAUZIONI / CREDITO","RAMI TRASPORTI"] },
      { k:"end_date", label:"Fine", type:"date" }
    ]},
    { title: "Preventivi pendenti", icon:"request_quote", arrayKey:"pending_quotes", itemTitle:"Preventivo", itemFields:[
      { k:"quote_id", label:"Quote ID", type:"text" },
      { k:"product", label:"Prodotto (ramo)", type:"select", opts:["AUTO","VITA","R.E.","CAUZIONI / CREDITO","RAMI TRASPORTI"] },
      { k:"saved_at", label:"Salvato il", type:"date" },
      { k:"coverage_start_date", label:"Inizio copertura", type:"date" },
      { k:"status", label:"Stato", type:"select", opts:["PENDING","DRAFT","SAVED"] }
    ]},
    { title: "Driver di valore (avanzato)", icon:"trending_up", collapsed:true, fields:[
      { k:"agency_profitability", label:"Redditività agenzia", type:"number", step:0.01, nullable:true },
      { k:"company_profitability_sp", label:"Redditività compagnia (SP)", type:"number", step:0.01, nullable:true },
      { k:"auto_premium_normalized", label:"Premio AUTO normalizzato", type:"number", step:0.01, nullable:true },
      { k:"auto_guarantees_weight_vct", label:"Peso garanzie AUTO (VCT)", type:"number", step:0.01, nullable:true },
      { k:"non_auto_premium_total", label:"Premio non-AUTO totale", type:"number", nullable:true }
    ]}
  ]};

  const LEAD_SCHEMA = { sections: [
    { title: "Dati lead", icon:"badge", fields: [
      { k:"lead_id", label:"Lead ID", type:"text", req:true },
      { k:"product", label:"Prodotto (ramo)", type:"select", opts:["AUTO","VITA","R.E.","CAUZIONI / CREDITO","RAMI TRASPORTI"] },
      { k:"marketing_consent", label:"Consenso marketing", type:"bool" }
    ]},
    { title: "Timing e preventivo", icon:"schedule", fields: [
      { k:"created_hours_ago", label:"Ore fa (creazione lead)", type:"number" },
      { k:"last_contact_days", label:"Ultimo contatto (gg fa)", type:"number", nullable:true, help:"vuoto = mai contattato" },
      { k:"quote_premium", label:"Premio preventivo €", type:"number", nullable:true },
      { k:"coverage_start_days", label:"Inizio copertura (tra N giorni)", type:"number", nullable:true }
    ]},
    { title: "Contatti e canale", icon:"contacts", fields: [
      { k:"email", label:"Email", type:"text", nullable:true },
      { k:"phone", label:"Telefono", type:"text", nullable:true },
      { k:"preferred_channel", label:"Canale preferito", type:"select", opts:["", "PHONE","EMAIL","SMS","WHATSAPP"], nullable:true },
      { k:"whatsapp_enabled", label:"WhatsApp abilitato", type:"tristate" }
    ]}
  ]};

  const SCHEMAS = { client: CLIENT_SCHEMA, lead: LEAD_SCHEMA };

  // ============================== human-readable dictionaries ==============================
  const TRIG_LABELS = {
    PAYMENT_OVERDUE: { lbl:"Pagamento in ritardo", sev:"hi", desc:d => Array.isArray(d?.days) && d.days.length ? `${d.days.join(", ")} giorni di ritardo` : (d?.days != null ? `${d.days} giorni di ritardo` : null) },
    HIGH_CHURN_RISK: { lbl:"Alto rischio abbandono", sev:"hi", desc:d => {
      const pol = (d?.policies||[])[0]; if (!pol) return null;
      const cr = pol.churn_rate != null ? `${Math.round(pol.churn_rate*100)}% di rischio` : null;
      return [`polizza ${pol.product}`, cr, pol.premium ? `premio €${pol.premium}` : null].filter(Boolean).join(" · ");
    }},
    SINGLE_POLICY_RISK: { lbl:"Cliente con una sola polizza", sev:"med", desc:d => d?.policy ? `solo polizza ${d.policy.product}` : null },
    OPEN_CLAIM: { lbl:"Sinistro aperto in gestione", sev:"hi", desc:d => d?.count_open ? `${d.count_open} sinistro/i aperti` : null },
    OPEN_COMPLAINT: { lbl:"Reclamo aperto", sev:"hi", desc:d => d?.count_open ? `${d.count_open} reclamo/i` : null },
    RENEWAL_7D:    { lbl:"Rinnovo polizza entro 7 giorni",  sev:"hi", desc:d => d?.policies?.[0] ? `${d.policies[0].policy.product||""}` : null },
    RENEWAL_14D:   { lbl:"Rinnovo polizza entro 14 giorni", sev:"hi", desc:d => d?.policies?.[0] ? `${d.policies[0].policy.product||""}` : null },
    RENEWAL_30D:   { lbl:"Rinnovo polizza entro 30 giorni", sev:"med", desc:d => d?.policies?.[0] ? `${d.policies[0].policy.product||""}` : null },
    RENEWAL_45D:   { lbl:"Rinnovo polizza entro 45 giorni", sev:"med", desc:d => d?.policies?.[0] ? `${d.policies[0].policy.product||""}` : null },
    MULTI_RENEWAL: { lbl:"Più polizze in rinnovo", sev:"hi" },
    COVERAGE_GAPS: { lbl:"Gap di copertura", sev:"med", desc:d => Array.isArray(d?.gaps) && d.gaps.length ? `manca: ${d.gaps.join(", ")}` : null },
    ACTIVE_CAMPAIGN: { lbl:"Campagna marketing attiva", sev:"med", desc:d => {
      const cs = d?.campaigns || []; if (!cs.length) return null;
      return cs.map(c => `${c.name || c.campaign_id} (${c.product_scope})`).join(" · ");
    }},
    PENDING_QUOTE: { lbl:"Preventivo in sospeso", sev:"med", desc:d => {
      const parts = [];
      if (d?.count_pending) parts.push(`${d.count_pending} preventivo/i`);
      if (d?.oldest_saved_days != null) parts.push(`il più vecchio: ${d.oldest_saved_days}g fa`);
      if (d?.nearest_coverage_start_days != null) parts.push(`copertura tra ${d.nearest_coverage_start_days}g`);
      return parts.length ? parts.join(" · ") : null;
    }},
    QUOTE_READY:      { lbl:"Preventivo pronto da presentare", sev:"med", desc:d => d?.premium ? `premio €${d.premium}/anno` : null },
    HIGH_VALUE_QUOTE: { lbl:"Preventivo ad alto valore", sev:"hi", desc:d => d?.premium ? `€${d.premium}/anno` : null },
    COVERAGE_START_SOON: { lbl:"Inizio copertura imminente", sev:"hi", desc:d => d?.days_remaining != null ? `tra ${d.days_remaining} giorni` : null },
    BIRTHDAY: { lbl:"Compleanno in arrivo", sev:"lo", desc:d => d?.days_remaining != null ? `tra ${d.days_remaining} giorni` : null },
    CUSTOMER_ANNIVERSARY: { lbl:"Anniversario cliente", sev:"lo", desc:d => d?.days_remaining != null ? `tra ${d.days_remaining} giorni` : null },
    CONTACT_OVERDUE: { lbl:"Cliente da ricontattare", sev:"med", desc:d => d?.days != null ? `non contattato da ${d.days} giorni` : null },
    CHECKUP_NOT_DONE: { lbl:"Check-up assicurativo da fare", sev:"med" },
    VIVA_NOT_ENROLLED:    { lbl:"Non ancora iscritto al programma VIVA", sev:"lo", desc:d => d?.policy_count ? `${d.policy_count} polizze attive` : null },
    VIVA_POINTS_EXPIRING: { lbl:"Punti VIVA in scadenza", sev:"med", desc:d => d?.expiring_points ? `${d.expiring_points} punti in scadenza` : null },
    VIVA_POINTS_HIGH:     { lbl:"Saldo punti VIVA elevato", sev:"lo", desc:d => d?.balance ? `saldo: ${d.balance} punti` : null },
    NEW_LEAD:   { lbl:"Lead appena ricevuto", sev:"hi", desc:d => d?.hours_since_creation != null ? `creato ${d.hours_since_creation}h fa` : null },
    STALE_LEAD: { lbl:"Lead non lavorato (stale)", sev:"hi", desc:d => d?.days != null ? `${d.days} giorni senza risposta` : null }
  };

  const ACTION_TRIGGERS = {
    CHURN_PREVENTION: ["HIGH_CHURN_RISK","SINGLE_POLICY_RISK","OPEN_COMPLAINT"],
    PAYMENT: ["PAYMENT_OVERDUE"],
    PAYMENT_FOLLOWUP: ["PAYMENT_OVERDUE"],
    RELATIONSHIP: ["OPEN_CLAIM","BIRTHDAY","CUSTOMER_ANNIVERSARY","CONTACT_OVERDUE","CHECKUP_NOT_DONE","OPEN_COMPLAINT"],
    CROSS_SELL: ["COVERAGE_GAPS","SINGLE_POLICY_RISK","ACTIVE_CAMPAIGN"],
    UPSELL: ["COVERAGE_GAPS","ACTIVE_CAMPAIGN"],
    RENEWAL: ["RENEWAL_7D","RENEWAL_14D","RENEWAL_30D","RENEWAL_45D","MULTI_RENEWAL"],
    ENGAGEMENT: ["VIVA_POINTS_EXPIRING","VIVA_POINTS_HIGH","VIVA_NOT_ENROLLED","CHECKUP_NOT_DONE","BIRTHDAY","CUSTOMER_ANNIVERSARY"],
    CAMPAIGN: ["ACTIVE_CAMPAIGN"],
    QUOTE_FOLLOW_UP: ["PENDING_QUOTE","QUOTE_READY","HIGH_VALUE_QUOTE","COVERAGE_START_SOON"],
    FIRST_CONTACT: ["NEW_LEAD"],
    LEAD_CONVERSION: ["QUOTE_READY","HIGH_VALUE_QUOTE","COVERAGE_START_SOON","NEW_LEAD"],
    RE_ENGAGEMENT: ["STALE_LEAD","CONTACT_OVERDUE"],
    NURTURING: ["STALE_LEAD","CONTACT_OVERDUE"]
  };

  const SEV_RANK = { hi:3, med:2, lo:1 };
  const FACTOR_LABELS = { urgency:"Urgenza", value:"Valore", opportunity:"Opportunità", recency:"Recency / contatto recente" };
  const STRATEGY_LABELS = { RETENTION:"Retention", CONVERSION:"Conversion", GROWTH:"Crescita / Cross-sell", NURTURING:"Nurturing" };
  const TIER_LABELS = { CRITICAL:"Priorità massima", HIGH:"Priorità alta", MEDIUM:"Priorità media", LOW:"Priorità bassa" };

  // ============================== state ==============================
  const STATE = {
    clients: [], leads: [],
    detailCache: {},          // key="client:C001" -> full NBA payload
    saved: [],                // localStorage "nba.lab.cases"
    snapshots: {},            // localStorage "nba.lab.snapshots"
    config: null,
    folder: "all",            // "all" | "tier:CRITICAL" | "type:client" | "saved"
    query: "",
    selected: null,           // {kind:"predef"|"saved"|"new", type, id}
    record: null,             // record corrente (editabile)
    lastResult: null,         // ultimo output NBA
    lastBreakdown: null,      // breakdown punteggio (Tangible)
    items: [],                // lista normalizzata
    detailTab: "nba",         // "nba" | "profile" | "compare"
    profileEdit: false,       // true → form editabile; false → vista read-only
    profileBackup: null,      // snapshot record per "Annulla"
    reviews: {},              // key "kind:type:id" → {judgement: "ok|ko|unsure", note, reviewedAt}
    hideReviewed: false,      // filtro lista
    cmpMode: "weights",       // weights | tiers | churn | leadthr | boosts | premiums | json
    cmpWeights: null,         // pesi (chiavi diverse per client/lead)
    cmpTiers: null,           // {CRITICAL, HIGH, MEDIUM} 0-100
    cmpChurn: null,           // 3 soglie churn
    cmpLeadThr: null,         // 5 soglie lead + contact overdue
    cmpBoosts: null,          // 4 boost trigger (0-50)
    cmpPremiums: null,        // 5 premi medi per prodotto
    cmpJson: "",              // textarea JSON (modalità avanzata)
    me: null,                 // utente loggato {id, username, role}
    commentsByTarget: {}      // cache thread commenti
  };
  const LS_SAVED = "nba.lab.cases";          // (residuale: solo per migrazione una-tantum)
  const LS_SNAP  = "nba.lab.snapshots";
  const LS_SIDEBAR = "nba.lab.sidebar.collapsed";
  const LS_TAB = "nba.lab.detail.tab";
  const LS_REVIEWS = "nba.lab.reviews";       // (residuale: solo per migrazione)
  const LS_HIDE_REVIEWED = "nba.lab.hideReviewed";
  const LS_TUTORIAL = "nba.lab.tutorial.seen";

  // ============================== utils ==============================
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
    const append = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(append); return; }
      if (typeof c === "string" || typeof c === "number") { e.appendChild(document.createTextNode(String(c))); return; }
      e.appendChild(c);
    };
    children.forEach(append);
    return e;
  };
  const fmtScore = v => (v == null ? "—" : (Math.round(v*10)/10).toFixed(1));
  const fmtDelta = v => (v == null || isNaN(v)) ? "—" : ((v >= 0 ? "+" : "") + (Math.round(v*10)/10).toFixed(1));
  const debounce = (fn, ms=200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  const toast = (m, k="") => { const t = $("#toast"); t.textContent = m; t.className = "toast show " + k; setTimeout(()=>{t.className = "toast " + k;}, 2400); };
  const jsonHL = obj => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
        (m) => { let c="n"; if (/^"/.test(m)) c=/:$/.test(m)?"k":"s"; else if (/true|false|null/.test(m)) c="b"; return `<span class="${c}">${m}</span>`; });
  };
  const fetchJSON = async (url, opts={}) => {
    const r = await fetch(url, { credentials: "include", ...opts });
    if (r.status === 204) return null;
    if (r.status === 401 && url.startsWith("/lab/api/") && url !== "/lab/api/login") {
      // Sessione scaduta → redirect a login (eccetto durante il check iniziale, che gestito a init)
      if (location.pathname !== "/lab/login.html") location.href = "/lab/login.html";
    }
    if (!r.ok) { let e=""; try{e=(await r.json()).detail||r.statusText;}catch{e=r.statusText;} throw new Error(`${r.status}: ${e}`); }
    return r.json();
  };
  const deepClone = o => JSON.parse(JSON.stringify(o));
  const tierColor = t => t === "CRITICAL" ? "#E80E3F" : t === "HIGH" ? "#F59E0B" : t === "MEDIUM" ? "#00E0CA" : "#D1D9E1";
  const channelIcon = ch => ({ PHONE:"call", EMAIL:"mail", SMS:"sms", WHATSAPP:"chat" }[ch] || "device_unknown");
  const sortItems = arr => arr.slice().sort((a,b) => {
    const sa = a.score == null ? -1 : a.score;
    const sb = b.score == null ? -1 : b.score;
    return sb - sa;
  });

  function emptyRecord(type) {
    if (type === "client") return {
      client_id:"", email:null, phone:null, preferred_channel:null, whatsapp_enabled:null,
      last_contact_days:null, birthday_days:null, anniversary_days:null,
      customer_tenure_years:null, active_policies_count:null, checkup_done:null,
      viva_enrolled:null, viva_points:null, viva_points_expiring:null,
      unpaid_days:[], cross_sell_gaps:[],
      policies:[], claims:null, complaints:null, active_campaigns:null, pending_quotes:null
    };
    return {
      lead_id:"", product:"AUTO", marketing_consent:true,
      created_hours_ago:24, last_contact_days:null, quote_premium:null, coverage_start_days:null,
      email:null, phone:null, preferred_channel:null, whatsapp_enabled:null
    };
  }

  // ============================== form renderer (unchanged) ==============================
  function renderForm(schema, data) {
    const root = el("div", {class:"form-root"});
    schema.sections.forEach(sec => {
      const wrap = el("div", {class:"section-block" + (sec.collapsed ? " collapsed" : "")});
      const headEl = el("div", {class:"section-head"},
        sec.icon ? el("span", {class:"msi section-ico"}, sec.icon) : null,
        el("h3", {}, sec.title),
        sec.arrayKey ? el("span", {class:"section-count"}, String((data[sec.arrayKey]||[]).length)) : null
      );
      wrap.appendChild(headEl);
      const bodyEl = el("div", {class:"section-body"});
      if (sec.arrayKey) {
        bodyEl.appendChild(renderArraySection(sec, data));
      } else if (sec.fields) {
        const grid = el("div", {class:"fld-grid"});
        sec.fields.forEach(f => { if (f.hideIf && f.hideIf(data)) return; grid.appendChild(renderField(f, data)); });
        if (sec.collapsed) {
          const acc = el("details", {class:"acc"}, el("summary", {}, "Mostra/nascondi sezione avanzata"), el("div", {class:"body"}, grid));
          bodyEl.appendChild(acc);
        } else {
          bodyEl.appendChild(grid);
        }
      }
      wrap.appendChild(bodyEl);
      root.appendChild(wrap);
    });
    return root;
  }

  function renderField(f, data) {
    const row = el("div", {class:"fld-row", "data-key":f.k, "data-type":f.type});
    const val = data[f.k];

    if (f.type === "tristate") {
      row.appendChild(el("label", {}, f.label));
      const wrap = el("div", {class:"tristate-wrap", "data-key":f.k});
      const opts = [{v:null, lbl:"—"}, {v:true, lbl:"Sì"}, {v:false, lbl:"No"}];
      const cur = val === undefined ? null : val;
      opts.forEach(o => {
        const b = el("button", {type:"button", "data-val":String(o.v)}, o.lbl);
        if (cur === o.v || (cur == null && o.v == null)) b.classList.add("on");
        b.addEventListener("click", () => {
          wrap.querySelectorAll("button").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          data[f.k] = o.v;
        });
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      return row;
    }

    if (f.type === "bool") {
      row.appendChild(el("label", {}, f.label));
      const sel = el("select", {},
        el("option", {value:"true"}, "Sì"),
        el("option", {value:"false"}, "No")
      );
      sel.value = (val === false) ? "false" : "true";
      sel.addEventListener("change", () => { data[f.k] = sel.value === "true"; });
      row.appendChild(sel);
      return row;
    }

    if (f.type === "select") {
      row.appendChild(el("label", {}, f.label));
      const sel = el("select", {});
      (f.opts || []).forEach(o => sel.appendChild(el("option", {value:o}, o === "" ? "—" : o)));
      sel.value = val == null ? (f.opts.includes("") ? "" : f.opts[0]) : val;
      sel.addEventListener("change", () => { data[f.k] = sel.value === "" ? null : sel.value; });
      row.appendChild(sel);
      return row;
    }

    if (f.type === "date") {
      row.appendChild(el("label", {}, f.label));
      const inp = el("input", {type:"date"});
      inp.value = val || "";
      inp.addEventListener("input", () => { data[f.k] = inp.value || null; });
      row.appendChild(inp);
      return row;
    }

    if (f.type === "numArray") {
      row.appendChild(el("label", {}, f.label + (f.help ? ` (${f.help})` : "")));
      const inp = el("input", {type:"text", placeholder:"es. 30, 45"});
      inp.value = Array.isArray(val) ? val.join(", ") : "";
      inp.addEventListener("input", () => {
        data[f.k] = inp.value.split(",").map(x => x.trim()).filter(Boolean).map(x => +x).filter(n => !isNaN(n));
      });
      row.appendChild(inp);
      return row;
    }

    if (f.type === "enumArray") {
      row.appendChild(el("label", {}, f.label));
      const cur = new Set(Array.isArray(val) ? val : []);
      const wrap = el("div", {class:"enum-checks"});
      (f.opts||[]).forEach(opt => {
        const cb = el("input", {type:"checkbox", value:opt});
        if (cur.has(opt)) cb.checked = true;
        cb.addEventListener("change", () => {
          if (cb.checked) cur.add(opt); else cur.delete(opt);
          data[f.k] = [...cur];
        });
        wrap.appendChild(el("label", {}, cb, " " + opt));
      });
      row.appendChild(wrap);
      return row;
    }

    const labelRow = el("label", {}, f.label);
    if (f.nullable) {
      const tgl = el("span", {class:"null-toggle"});
      const cbNull = el("input", {type:"checkbox"});
      cbNull.checked = (val === null || val === undefined);
      tgl.append(cbNull, " null");
      labelRow.appendChild(tgl);
      cbNull.addEventListener("change", () => {
        if (cbNull.checked) { data[f.k] = null; row.classList.add("disabled"); inp.value = ""; inp.disabled = true; }
        else { data[f.k] = f.type === "number" ? 0 : ""; inp.value = String(data[f.k]); inp.disabled = false; row.classList.remove("disabled"); }
      });
    }
    row.appendChild(labelRow);
    const inp = el("input", {type: f.type === "number" ? "number" : "text"});
    if (f.type === "number" && f.step != null) inp.setAttribute("step", String(f.step));
    if (val == null) { inp.value = ""; if (f.nullable) { inp.disabled = true; row.classList.add("disabled"); } }
    else inp.value = String(val);
    inp.addEventListener("input", () => {
      if (inp.value === "" && f.nullable) { data[f.k] = null; return; }
      if (f.type === "number") {
        const n = Number(inp.value);
        data[f.k] = isNaN(n) ? null : n;
      } else {
        data[f.k] = inp.value;
      }
    });
    row.appendChild(inp);
    return row;
  }

  function renderArraySection(sec, data) {
    const container = el("div", {"data-array":sec.arrayKey});
    const list = data[sec.arrayKey];
    const isNullable = list === null || list === undefined;
    if (isNullable) {
      container.appendChild(el("div", {class:"muted", style:{fontSize:"12px",marginBottom:"8px"}}, "Nessun elemento (campo nullo)."));
    } else {
      list.forEach((item, idx) => container.appendChild(renderArrayCard(sec, list, idx, container, data)));
    }
    const addBtn = el("button", {class:"btn ghost arr-add", type:"button"}, el("span", {class:"msi"}, "add"), " Aggiungi " + (sec.itemTitle || "elemento"));
    addBtn.addEventListener("click", () => {
      if (data[sec.arrayKey] == null) data[sec.arrayKey] = [];
      const newItem = {};
      sec.itemFields.forEach(f => {
        if (f.type === "select" && f.opts.length) newItem[f.k] = f.opts[0];
        else if (f.type === "number") newItem[f.k] = 0;
        else newItem[f.k] = "";
      });
      data[sec.arrayKey].push(newItem);
      reRenderSection(sec, data, container);
    });
    container.appendChild(addBtn);
    return container;
  }

  function reRenderSection(sec, data, container) {
    // Caso form normale: rimpiazza l'intero <.section-block> che avvolge la sezione
    const sectionBlock = container.closest(".section-block");
    if (sectionBlock) {
      const newRoot = renderForm({sections:[sec]}, data);
      sectionBlock.parentNode.replaceChild(newRoot.firstChild, sectionBlock);
      return;
    }
    // Caso wizard (nessun .section-block): rirenderizza la sezione array in place
    if (container.parentNode) {
      container.parentNode.replaceChild(renderArraySection(sec, data), container);
    }
  }

  function renderArrayCard(sec, list, idx, parentNode, data) {
    const card = el("div", {class:"arr-card"});
    card.appendChild(el("div", {class:"arr-card-head"},
      el("span", {class:"ttl"}, `${sec.itemTitle} #${idx+1}`),
      el("button", {class:"btn danger arr-remove", type:"button",
        onclick: () => {
          list.splice(idx, 1);
          reRenderSection(sec, data, parentNode);
        }
      }, el("span", {class:"msi"}, "delete"), " Rimuovi")
    ));
    const grid = el("div", {class:"fld-grid"});
    sec.itemFields.forEach(f => grid.appendChild(renderField(f, list[idx])));
    card.appendChild(grid);
    return card;
  }

  // ============================== items / list / folders ==============================
  function buildItems() {
    // Returns normalized items for the list pane.
    // Predef items come from STATE.clients/leads; saved items from STATE.saved.
    const out = [];
    STATE.clients.forEach(c => {
      const det = STATE.detailCache[`client:${c.client_id}`];
      out.push({
        kind:"predef", type:"client", id:c.client_id,
        name: c.client_id,
        snippet: summarizeTriggers(det),
        score: c.priority_score, tier: c.priority_tier, strategy: c.strategic_category,
        ts: relTs("client", c.client_json),
        data: c.client_json
      });
    });
    STATE.leads.forEach(l => {
      const det = STATE.detailCache[`lead:${l.lead_id}`];
      out.push({
        kind:"predef", type:"lead", id:l.lead_id,
        name: l.lead_id,
        snippet: summarizeTriggers(det),
        score: l.priority_score, tier: l.priority_tier, strategy: l.strategic_category,
        ts: relTs("lead", l.lead_json),
        data: l.lead_json
      });
    });
    STATE.saved.forEach(s => {
      out.push({
        kind:"saved", type:s.type, id:s.id,
        name: s.name || "(senza nome)",
        snippet: s.notes || "Caso salvato",
        score: null, tier: null, strategy: null,
        ts: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "",
        data: s.record,
        owner_id: s.owner_id, shared: !!s.shared,
        savedRef: s
      });
    });
    return out;
  }

  function summarizeTriggers(det) {
    if (!det || !det.triggers || !det.triggers.length) return "Nessun trigger attivo.";
    const enriched = det.triggers.map(t => ({
      lbl: TRIG_LABELS[t]?.lbl || t.replace(/_/g, " ").toLowerCase(),
      sev: TRIG_LABELS[t]?.sev || "lo"
    })).sort((a,b) => (SEV_RANK[b.sev]||0) - (SEV_RANK[a.sev]||0));
    const top = enriched.slice(0, 3).map(x => x.lbl).join(" · ");
    const extra = enriched.length > 3 ? ` (+${enriched.length-3})` : "";
    return top + extra;
  }

  function relTs(type, raw) {
    if (!raw) return "";
    if (type === "client") {
      const d = raw.last_contact_days;
      if (d == null) return "mai contattato";
      if (d === 0) return "contatto oggi";
      return `contatto ${d}g fa`;
    }
    const h = raw.created_hours_ago;
    if (h == null) return "";
    if (h < 24) return `lead di ${h}h fa`;
    return `lead di ${Math.round(h/24)}g fa`;
  }

  function folderMatches(item, folder) {
    if (folder === "all") return item.kind === "predef";
    if (folder === "saved")  return item.kind === "saved" && item.owner_id === STATE.me?.id;
    if (folder === "shared") return item.kind === "saved" && !!item.shared && item.owner_id !== STATE.me?.id;
    if (folder.startsWith("tier:")) return item.kind === "predef" && item.tier === folder.slice(5);
    if (folder.startsWith("type:")) return item.kind === "predef" && item.type === folder.slice(5);
    return true;
  }

  function applyQuery(items, q) {
    if (!q) return items;
    const ql = q.toLowerCase();
    return items.filter(it =>
      it.id.toLowerCase().includes(ql) ||
      (it.name||"").toLowerCase().includes(ql) ||
      (it.snippet||"").toLowerCase().includes(ql)
    );
  }

  function updateFolderCounts() {
    const items = STATE.items;
    const ctn = (pred) => items.filter(pred).length;
    const map = {
      "all": ctn(i => i.kind === "predef"),
      "saved":  ctn(i => i.kind === "saved" && i.owner_id === STATE.me?.id),
      "shared": ctn(i => i.kind === "saved" && !!i.shared && i.owner_id !== STATE.me?.id),
      "tier:CRITICAL": ctn(i => i.kind === "predef" && i.tier === "CRITICAL"),
      "tier:HIGH":     ctn(i => i.kind === "predef" && i.tier === "HIGH"),
      "tier:MEDIUM":   ctn(i => i.kind === "predef" && i.tier === "MEDIUM"),
      "tier:LOW":      ctn(i => i.kind === "predef" && i.tier === "LOW"),
      "type:client":   ctn(i => i.kind === "predef" && i.type === "client"),
      "type:lead":     ctn(i => i.kind === "predef" && i.type === "lead")
    };
    Object.entries(map).forEach(([k,v]) => {
      const c = document.querySelector(`[data-cnt="${k}"]`);
      if (c) c.textContent = String(v);
    });
  }

  function renderListPane() {
    const box = $("#ml-list"); box.innerHTML = "";
    let items = STATE.items.filter(it => folderMatches(it, STATE.folder));
    items = applyQuery(items, STATE.query);
    if (STATE.hideReviewed) items = items.filter(it => !getReview(it));
    items = sortItems(items);
    const reviewedTot = STATE.items.filter(it => folderMatches(it, STATE.folder) && getReview(it)).length;
    const allTot      = STATE.items.filter(it => folderMatches(it, STATE.folder)).length;
    $("#ml-list-meta").textContent = `${items.length} su ${allTot} · ${reviewedTot} analizzat${reviewedTot===1?"o":"i"}`;
    if (!items.length) {
      box.appendChild(el("div", {class:"ml-list-empty"}, "Nessuna anagrafica in questa cartella"));
      return;
    }
    items.forEach(it => {
      const isActive = STATE.selected && STATE.selected.kind === it.kind && STATE.selected.id === it.id;
      const rev = getReview(it);
      const node = el("div", {class:"ml-item" + (isActive ? " active" : "") + (rev ? " reviewed" : "")},
        el("div", {class:"ml-dot " + (it.tier || "LOW")}),
        el("div", {class:"ml-id"}, it.name, el("span", {class:"type-mini"}, it.type === "client" ? "CLI" : "LEAD")),
        el("div", {class:"ml-score"},
          rev ? el("span", {class:"review-badge " + rev.judgement, title:"Giudizio: " + REVIEW_META[rev.judgement].lbl},
                  el("span", {class:"msi"}, REVIEW_META[rev.judgement].icon)) : null,
          " " + (it.score != null ? Math.round(it.score) : "—")
        ),
        el("div", {class:"ml-snippet"}, it.snippet || "—"),
        el("div", {class:"ml-foot"},
          el("span", {class:"strat"}, (STRATEGY_LABELS[it.strategy] || it.strategy || "—")),
          el("span", {class:"ts"}, it.ts || "")
        ),
        it.kind === "saved" ? el("span", {class:"saved-mark"}, "Salvato") : null
      );
      node.addEventListener("click", () => loadAnagrafica(it));
      box.appendChild(node);
    });
  }

  // ============================== detail pane ==============================
  async function loadAnagrafica(it) {
    STATE.selected = { kind: it.kind, type: it.type, id: it.id };
    STATE.record = deepClone(it.data || emptyRecord(it.type));
    STATE.lastResult = null;
    STATE.lastBreakdown = null;
    STATE.profileEdit = false;
    STATE.profileBackup = null;
    renderListPane();
    renderDetail(it);
    document.documentElement.classList.add("has-selection");
    await runNBA(); // auto-run come una mail che si "apre"
  }

  function initCmpFromConfig() {
    const cfg = STATE.config || {};
    const getV = x => (x && typeof x === "object" && "value" in x) ? x.value : x;
    const w = cfg["client_weights"] || {};
    STATE.cmpWeights = {};
    weightFactorsFor("client").forEach(f => {
      STATE.cmpWeights[f.k] = getV(w[f.k]) ?? (1 / weightFactorsFor("client").length);
    });
    const t = cfg.tiers || {};
    STATE.cmpTiers = {
      CRITICAL: getV(t.CRITICAL) ?? 81,
      HIGH:     getV(t.HIGH)     ?? 65,
      MEDIUM:   getV(t.MEDIUM)   ?? 47
    };
    const thr = cfg.thresholds || {};
    STATE.cmpChurn = {
      HIGH_CHURN_THRESHOLD:           getV(thr.HIGH_CHURN_THRESHOLD)           ?? 0.28,
      SINGLE_POLICY_CHURN_THRESHOLD:  getV(thr.SINGLE_POLICY_CHURN_THRESHOLD)  ?? 0.53,
      CHURN_OVERRIDE_RENEWAL_DAYS:    getV(thr.CHURN_OVERRIDE_RENEWAL_DAYS)    ?? 285
    };
    STATE.cmpLeadThr = {
      NO_CONTACT_DAYS_THRESHOLD:         getV(thr.NO_CONTACT_DAYS_THRESHOLD)         ?? 90,
      LEAD_NEW_HOURS_THRESHOLD:          getV(thr.LEAD_NEW_HOURS_THRESHOLD)          ?? 134,
      LEAD_STALE_DAYS_THRESHOLD:         getV(thr.LEAD_STALE_DAYS_THRESHOLD)         ?? 10,
      LEAD_COVERAGE_START_SOON_DAYS:     getV(thr.LEAD_COVERAGE_START_SOON_DAYS)     ?? 14,
      LEAD_HIGH_VALUE_PREMIUM_THRESHOLD: getV(thr.LEAD_HIGH_VALUE_PREMIUM_THRESHOLD) ?? 1900
    };
    STATE.cmpBoosts = {
      OPEN_CASE_URGENCY_BOOST:           getV(thr.OPEN_CASE_URGENCY_BOOST)           ?? 26,
      ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST: getV(thr.ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST) ?? 41,
      VIVA_EXPIRING_OPPORTUNITY_BOOST:   getV(thr.VIVA_EXPIRING_OPPORTUNITY_BOOST)   ?? 20,
      PENDING_QUOTE_OPPORTUNITY_BOOST:   getV(thr.PENDING_QUOTE_OPPORTUNITY_BOOST)   ?? 36
    };
    const ap = cfg.avg_premiums || {};
    STATE.cmpPremiums = {
      CASA:                              getV(ap.CASA)                              ?? 1700,
      INFORTUNI:                         getV(ap.INFORTUNI)                         ?? 350,
      MALATTIA:                          getV(ap.MALATTIA)                          ?? 550,
      VITA_PROTEZIONE:                   getV(ap.VITA_PROTEZIONE)                   ?? 600,
      PREVIDENZA_COMPLEMENTARE:          getV(ap.PREVIDENZA_COMPLEMENTARE)          ?? 1200,
      RESPONSABILITA_PROFESSIONALE:      getV(ap.RESPONSABILITA_PROFESSIONALE)      ?? 800,
      VITA_PRIVATA_RESPONSABILITA_CIVILE: getV(ap.VITA_PRIVATA_RESPONSABILITA_CIVILE) ?? 150,
      VITA_PRIVATA_ANIMALI_DOMESTICI:    getV(ap.VITA_PRIVATA_ANIMALI_DOMESTICI)    ?? 100,
      VITA_PRIVATA_TUTELA_LEGALE:        getV(ap.VITA_PRIVATA_TUTELA_LEGALE)        ?? 150,
      VITA_PRIVATA_MICROMOBILITA:        getV(ap.VITA_PRIVATA_MICROMOBILITA)        ?? 80,
      VITA_PRIVATA_VIAGGI:               getV(ap.VITA_PRIVATA_VIAGGI)               ?? 90
    };
    STATE.cmpJson = JSON.stringify(cfg, null, 2);
  }

  function openNewDraft(type = "client") {
    STATE.selected = { kind:"new", type, id:"(nuovo)" };
    STATE.record = emptyRecord(type);
    STATE.lastResult = null;
    STATE.profileEdit = true; // nuova anagrafica → subito editabile
    STATE.profileBackup = deepClone(STATE.record);
    renderListPane();
    renderDetail({ kind:"new", type, id:"(nuovo)" });
  }

  function coverageGapsFromResult() {
    const td = STATE.lastResult && STATE.lastResult.trigger_details;
    const g = td && td.COVERAGE_GAPS && td.COVERAGE_GAPS.gaps;
    return Array.isArray(g) ? g : [];
  }
  // Mostra nella tab Profilo le scoperture DERIVATE da insurance_needs (read-only):
  // il campo grezzo cross_sell_gaps è quasi sempre vuoto, le scoperture vere le calcola l'NBA.
  function fillProfileGaps() {
    const box = document.getElementById("profile-gaps");
    if (!box) return;
    box.innerHTML = "";
    const gaps = coverageGapsFromResult();
    if (!gaps.length) return;
    box.appendChild(el("div", {class:"profile-gaps-note"},
      el("span", {class:"msi"}, "search_insights"),
      el("div", {},
        el("div", {}, el("strong", {}, "Scoperture rilevate "),
          el("span", {class:"muted"}, "(derivate da insurance_needs — calcolate dall'NBA, non modificabili qui)")),
        el("div", {class:"gaps-chips"}, ...gaps.map(g => el("span", {class:"gap-chip"}, g))))));
  }

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
        // Email di default: il motore sopprime l'NBA se manca sia email che telefono
        // (contactability). Così lo scenario è "eleggibile"; l'utente può cambiarla.
        WIZ.record.email = "test@esempio.it";
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
    }
    panel.appendChild(bodyEl);
    if (isSummary) wizardPreview();  // dopo l'append: #wiz-preview ora è nel DOM
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

  function renderDetail(it) {
    const pane = $("#ml-detail");
    pane.innerHTML = "";

    // header
    const head = el("div", {class:"ml-detail-head"});
    const isNew = it.kind === "new";
    const tier = STATE.lastResult?.priority_tier || it.tier;
    const score = STATE.lastResult?.priority_score ?? it.score;
    // Back button — su desktop è nascosto, su mobile vive DENTRO al top-row (left)
    const backBtn = el("button", {class:"ml-back", title:"Torna alla lista", onclick: () => { STATE.selected = null; document.documentElement.classList.remove("has-selection"); renderListPane(); $("#ml-detail").innerHTML = emptyDetailHTML(); }},
      el("span", {class:"msi"}, "arrow_back"),
      el("span", {class:"ml-back-lbl"}, " Lista")
    );

    const titleRow = el("div", {class:"top-row"},
      backBtn,                                            // su mobile è il primo, su desktop è display:none
      el("div", {class:"title-block"},
        el("div", {class:"ml-title"},
          el("span", {class:"ml-id-big"}, it.id),
          el("span", {class:`type-tag ${it.type}`}, it.type === "client" ? "Cliente" : "Lead"),
          tier ? el("span", {class:`tier ${tier}`}, tier) : null
        ),
        el("div", {class:"ml-detail-meta"},
          STATE.lastResult ? el("span", {}, el("strong", {}, "Strategia: "), STRATEGY_LABELS[STATE.lastResult.strategic_category] || STATE.lastResult.strategic_category || "—") : null,
          STATE.lastResult ? el("span", {}, el("strong", {}, "Modalità: "), STATE.lastResult.presentation_mode || "—") : null,
          isNew ? el("span", {class:"muted"}, "Nuova anagrafica — compila il form qui sotto") : null
        )
      ),
      el("div", {class:"ml-detail-actions"},
        el("button", {class:"btn primary-cta", onclick: () => { switchDetailTab("nba"); runNBA(); }, id:"detail-run"}, el("span", {class:"msi"}, "play_arrow"), " Esegui NBA"),
        el("button", {class:"btn ghost", onclick: () => { startProfileEdit(); switchDetailTab("profile"); }}, el("span", {class:"msi"}, "edit"), " Modifica record"),
        el("button", {class:"btn ghost", onclick: showSaveDialog}, el("span", {class:"msi"}, "save"), " Salva caso"),
        it.kind === "saved" ? el("button", {class:"btn danger", onclick: () => deleteCurrentSaved()}, el("span", {class:"msi"}, "delete"), " Elimina") : null
      )
    );
    head.appendChild(titleRow);

    // review bar (operatore)
    head.appendChild(buildReviewBar(it));

    // tab strip
    const tabsBar = el("div", {class:"detail-tabs", id:"detail-tabs"},
      el("button", {class:"dtab", "data-tab":"nba", onclick:()=>switchDetailTab("nba")},
        el("span", {class:"msi"}, "auto_awesome"), " NBA"),
      el("button", {class:"dtab", "data-tab":"profile", onclick:()=>switchDetailTab("profile")},
        el("span", {class:"msi"}, "badge"), " Profilo")
    );
    head.appendChild(tabsBar);
    pane.appendChild(head);

    // body
    const body = el("div", {class:"ml-detail-body"});

    // ---- NBA tab pane ----
    const nbaPane = el("div", {class:"tab-pane", "data-tab":"nba"});
    const resultBox = el("div", {id:"result-box"});
    if (STATE.lastResult) {
      resultBox.appendChild(renderResultCard(STATE.lastResult));
    } else {
      resultBox.appendChild(el("div", {class:"ml-not-run"},
        el("span", {class:"msi"}, "play_arrow"),
        " Premi “Esegui NBA” per calcolare la priorità per questa anagrafica."));
    }
    nbaPane.appendChild(resultBox);
    body.appendChild(nbaPane);

    // ---- Profile tab pane ----
    const profilePane = el("div", {class:"tab-pane", "data-tab":"profile"});
    profilePane.appendChild(buildProfileIntro());
    profilePane.appendChild(el("div", {id:"profile-gaps"}));
    profilePane.appendChild(STATE.profileEdit
      ? renderForm(SCHEMAS[STATE.selected.type], STATE.record)
      : renderFormView(SCHEMAS[STATE.selected.type], STATE.record));
    fillProfileGaps();
    body.appendChild(profilePane);

    pane.appendChild(body);

    // initial tab: new records open on Profilo, others restore from LS or default NBA
    const tabFromLS = localStorage.getItem(LS_TAB);
    const valid = ["nba","profile"];
    STATE.detailTab = isNew ? "profile" : (valid.includes(tabFromLS) ? tabFromLS : "nba");
    syncDetailTab();
  }

  function switchDetailTab(tab) {
    STATE.detailTab = tab;
    localStorage.setItem(LS_TAB, tab);
    syncDetailTab();
  }

  function syncDetailTab() {
    document.querySelectorAll("#detail-tabs .dtab").forEach(b => b.classList.toggle("active", b.dataset.tab === STATE.detailTab));
    document.querySelectorAll(".ml-detail-body .tab-pane").forEach(p => p.classList.toggle("active", p.dataset.tab === STATE.detailTab));
  }

  function emptyDetailHTML() {
    return `
      <div class="ml-empty">
        <div class="ml-empty-ico">📋</div>
        <div class="ml-empty-title">Seleziona un'anagrafica</div>
        <div class="ml-empty-sub">Scegli un caso a sinistra per vedere il dettaglio, oppure crea una nuova anagrafica.</div>
      </div>`;
  }

  // ============================== result card (Perché + Azioni) ==============================
  function renderResultCard(out) {
    const wrap = el("div", {});
    const tier = out.priority_tier || "LOW";
    const score = out.priority_score;
    const acts = out.recommended_actions || [];
    const primary = acts.filter(a => a.primary);
    const secondary = acts.filter(a => !a.primary);

    // Card 1: Riepilogo (score bubble + mini stats)
    const tierLabel = TIER_LABELS[tier] || tier;
    const stratLabel = STRATEGY_LABELS[out.strategic_category] || out.strategic_category || "—";
    const presLabel = out.presentation_mode || "—";
    const nTrigs = (out.triggers || []).length;
    const nActs = acts.length;
    // dominant weight factor (from config)
    const wkey = STATE.selected?.type === "client" ? "client_weights" : "lead_weights";
    const weights = (STATE.config || {})[wkey] || {};
    const wEntries = Object.entries(weights).map(([k,v]) => ({k, v: (v && typeof v === "object" ? v.value : v)})).filter(x => typeof x.v === "number").sort((a,b) => b.v - a.v);
    const topFactor = wEntries[0];

    wrap.appendChild(el("div", {class:"section-block result-summary"},
      el("div", {class:"section-head"},
        el("span", {class:"msi section-ico"}, "insights"),
        el("h3", {}, "Riepilogo priorità")
      ),
      el("div", {class:"section-body"},
        el("div", {class:"summary-row"},
          el("div", {class:"summary-score"},
            el("div", {class:"score-bubble " + tier}, score == null ? "—" : String(Math.round(score))),
            el("div", {class:"score-meta"},
              el("div", {class:"score-tier-name"}, tier),
              el("div", {class:"score-tier-label"}, tierLabel)
            )
          ),
          el("div", {class:"summary-stats"},
            statTile("Strategia", stratLabel, "track_changes"),
            statTile("Modalità", presLabel, "view_compact"),
            statTile("Trigger attivi", String(nTrigs), "bolt"),
            statTile("Azioni totali", String(nActs) + (primary.length ? ` (${primary.length} primary)` : ""), "checklist"),
            topFactor ? statTile("Fattore dominante", (FACTOR_LABELS[topFactor.k] || topFactor.k) + " · " + Math.round(topFactor.v*100) + "%", "leaderboard") : null
          )
        )
      )
    ));

    // Card 2: Perché questa priorità
    wrap.appendChild(el("div", {class:"section-block"},
      el("div", {class:"section-head"},
        el("span", {class:"msi section-ico"}, "psychology"),
        el("h3", {}, "Perché questa priorità?")
      ),
      el("div", {class:"section-body"}, renderExplanation(out))
    ));

    // Card 3: Azione principale (PRIMARY)
    if (primary.length) {
      wrap.appendChild(el("div", {class:"section-block primary-section"},
        el("div", {class:"section-head"},
          el("span", {class:"msi section-ico"}, "flag"),
          el("h3", {}, "Azione principale (PRIMARY)"),
          el("span", {class:"section-count"}, String(primary.length))
        ),
        el("div", {class:"section-body"}, renderActionCards(primary, out, true))
      ));
    }

    // Card 4: Azioni complementari (SECONDARY)
    if (secondary.length) {
      wrap.appendChild(el("div", {class:"section-block"},
        el("div", {class:"section-head"},
          el("span", {class:"msi section-ico"}, "list_alt"),
          el("h3", {}, "Azioni complementari (SECONDARY)"),
          el("span", {class:"section-count"}, String(secondary.length))
        ),
        el("div", {class:"section-body"}, renderActionCards(secondary, out, false))
      ));
    }

    // Card 5: Dettagli tecnici (sub-accordion)
    const techBody = el("div", {class:"section-body"});
    if (out.value_breakdown) {
      techBody.appendChild(el("details", {class:"acc"},
        el("summary", {}, el("span", {class:"msi"}, "analytics"), " Breakdown VALUE score (debug)"),
        el("div", {class:"body"}, el("pre", {class:"json", innerHTML: jsonHL(out.value_breakdown)}))
      ));
    }
    techBody.appendChild(el("details", {class:"acc"},
      el("summary", {}, el("span", {class:"msi"}, "bolt"), " Trigger dettagliati"),
      el("div", {class:"body"}, el("pre", {class:"json", innerHTML: jsonHL(out.trigger_details || {})}))
    ));
    techBody.appendChild(el("details", {class:"acc"},
      el("summary", {}, el("span", {class:"msi"}, "code"), " Output completo (JSON)"),
      el("div", {class:"body"}, el("pre", {class:"json", innerHTML: jsonHL(out)}))
    ));
    wrap.appendChild(el("div", {class:"section-block"},
      el("div", {class:"section-head"},
        el("span", {class:"msi section-ico"}, "engineering"),
        el("h3", {}, "Dettagli tecnici")
      ),
      techBody
    ));

    return wrap;
  }

  // ---- Profile view/edit ----
  function buildProfileIntro() {
    const it = STATE.selected;
    const intro = el("div", {class:"profile-intro"});
    intro.appendChild(el("div", {},
      el("div", {class:"profile-title"},
        el("span", {class:"msi"}, "badge"),
        " Anagrafica " + (it.type === "client" ? "cliente" : "lead")),
      el("div", {class:"profile-sub"}, STATE.profileEdit
        ? "Modifica i campi e premi “Salva modifiche” per applicare."
        : "Sola visualizzazione. Premi “Modifica” per cambiare i campi.")
    ));
    if (STATE.profileEdit) {
      intro.appendChild(el("div", {class:"profile-actions"},
        el("button", {class:"btn primary-cta", onclick: saveProfileEdit},
          el("span", {class:"msi"}, "check"), " Salva modifiche"),
        el("button", {class:"btn ghost", onclick: cancelProfileEdit},
          el("span", {class:"msi"}, "close"), " Annulla")
      ));
    } else {
      intro.appendChild(el("div", {class:"profile-actions"},
        el("button", {class:"btn", onclick: startProfileEdit},
          el("span", {class:"msi"}, "edit"), " Modifica")
      ));
    }
    return intro;
  }

  function startProfileEdit() {
    STATE.profileEdit = true;
    STATE.profileBackup = deepClone(STATE.record);
    rerenderProfilePane();
  }
  function cancelProfileEdit() {
    if (STATE.profileBackup) STATE.record = STATE.profileBackup;
    STATE.profileEdit = false;
    STATE.profileBackup = null;
    rerenderProfilePane();
  }
  function saveProfileEdit() {
    STATE.profileEdit = false;
    STATE.profileBackup = null;
    rerenderProfilePane();
    toast("Modifiche applicate — puoi ora rieseguire l'NBA", "ok");
  }
  function rerenderProfilePane() {
    const pane = document.querySelector('.tab-pane[data-tab="profile"]');
    if (!pane) return;
    pane.innerHTML = "";
    pane.appendChild(buildProfileIntro());
    pane.appendChild(STATE.profileEdit
      ? renderForm(SCHEMAS[STATE.selected.type], STATE.record)
      : renderFormView(SCHEMAS[STATE.selected.type], STATE.record));
  }

  function renderFormView(schema, data) {
    const root = el("div", {class:"form-root form-view"});
    schema.sections.forEach(sec => {
      const wrap = el("div", {class:"section-block" + (sec.collapsed ? " collapsed" : "")});
      wrap.appendChild(el("div", {class:"section-head"},
        sec.icon ? el("span", {class:"msi section-ico"}, sec.icon) : null,
        el("h3", {}, sec.title),
        sec.arrayKey ? el("span", {class:"section-count"}, String((data[sec.arrayKey]||[]).length)) : null
      ));
      const bodyEl = el("div", {class:"section-body"});
      if (sec.arrayKey) {
        bodyEl.appendChild(renderArrayView(sec, data));
      } else if (sec.fields) {
        bodyEl.appendChild(renderFieldsView(sec.fields, data));
      }
      wrap.appendChild(bodyEl);
      root.appendChild(wrap);
    });
    return root;
  }
  function renderFieldsView(fields, data) {
    const grid = el("dl", {class:"view-grid"});
    fields.forEach(f => {
      if (f.hideIf && f.hideIf(data)) return;
      const val = data[f.k];
      const empty = (val == null || val === "" || (Array.isArray(val) && val.length === 0));
      grid.appendChild(el("div", {class:"view-row"},
        el("dt", {}, f.label),
        el("dd", {class: empty ? "muted" : ""}, formatViewValue(f, val))
      ));
    });
    return grid;
  }
  function renderArrayView(sec, data) {
    const list = data[sec.arrayKey];
    if (list == null || (Array.isArray(list) && list.length === 0)) {
      return el("div", {class:"muted", style:{fontSize:"12px"}}, "Nessun elemento.");
    }
    const container = el("div", {});
    list.forEach((item, idx) => {
      container.appendChild(el("div", {class:"arr-card view"},
        el("div", {class:"arr-card-head"}, el("span", {class:"ttl"}, `${sec.itemTitle} #${idx+1}`)),
        renderFieldsView(sec.itemFields, item)
      ));
    });
    return container;
  }
  function formatViewValue(f, val) {
    if (val == null || val === "") return "—";
    if (f.type === "tristate" || f.type === "bool") return val === true ? "Sì" : val === false ? "No" : "—";
    if (f.type === "numArray") return Array.isArray(val) && val.length ? val.join(", ") : "—";
    if (f.type === "enumArray") return Array.isArray(val) && val.length ? val.join(", ") : "—";
    if (f.type === "date") return val;
    if (f.type === "number" && typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(2);
    return String(val);
  }

  function statTile(label, value, icon) {
    return el("div", {class:"stat-tile"},
      icon ? el("span", {class:"msi stat-ico"}, icon) : null,
      el("div", {class:"stat-text"},
        el("div", {class:"stat-k"}, label),
        el("div", {class:"stat-v"}, value)
      )
    );
  }

  function renderActionCards(acts, out, primary) {
    const wrap = el("div", {class:"actions-list"});
    const presentTriggers = new Set(out?.triggers || []);
    acts.forEach(a => {
      const causes = (ACTION_TRIGGERS[a.action_category] || []).filter(t => presentTriggers.has(t));
      const causeLabels = causes.map(c => (TRIG_LABELS[c]?.lbl || c)).slice(0, 3);
      wrap.appendChild(el("div", {class:"action-card" + (primary ? " primary" : "")},
        el("div", {class:"head"},
          el("span", {class:"act-cat"}, a.action_category || ""),
          el("span", {class:"chip"}, el("span", {class:"msi"}, channelIcon(a.recommended_channel)), " " + (a.recommended_channel || "—")),
          a.suggest_appointment ? el("span", {class:"chip"}, el("span", {class:"msi"}, "event"), " appuntamento") : null
        ),
        el("div", {class:"desc"}, a.recommended_action || ""),
        causeLabels.length ? el("div", {class:"caused-by"},
          el("span", {class:"caused-by-lbl"}, "Causata da:"),
          " " + causeLabels.join(" · ")
        ) : null
      ));
    });
    return wrap;
  }

  function renderExplanation(out) {
    const wrap = el("div", {class:"why-inner"});

    const trigs = out.triggers || [];
    const tDet = out.trigger_details || {};
    const entries = trigs.map(t => ({
      code: t,
      label: TRIG_LABELS[t]?.lbl || t.replace(/_/g, " ").toLowerCase(),
      detail: (TRIG_LABELS[t]?.desc ? TRIG_LABELS[t].desc(tDet[t]) : null),
      sev: TRIG_LABELS[t]?.sev || "lo"
    }));
    entries.sort((a,b) => (SEV_RANK[b.sev]||0) - (SEV_RANK[a.sev]||0));

    const strategy = STRATEGY_LABELS[out.strategic_category] || out.strategic_category || "";
    const tierLabel = TIER_LABELS[out.priority_tier] || out.priority_tier;
    let synth;
    if (entries.length === 0) {
      synth = `${tierLabel} — nessun segnale rilevante.`;
    } else {
      const top = entries.slice(0, 2).map(e => e.label).join(" + ");
      const rest = entries.length - 2;
      const restTxt = rest > 0 ? ` (+${rest} altri segnali)` : "";
      const stratTxt = strategy ? ` · strategia: ${strategy}` : "";
      synth = `${tierLabel}${stratTxt}. Fattori principali: ${top}${restTxt}.`;
    }
    wrap.appendChild(el("div", {class:"why-synth"}, synth));

    const cfg = STATE.config || {};
    const tierSched = cfg.tiers || {};
    const thr = { CRITICAL: tierSched.CRITICAL?.value, HIGH: tierSched.HIGH?.value, MEDIUM: tierSched.MEDIUM?.value }[out.priority_tier];
    const wkey = STATE.selected?.type === "client" ? "client_weights" : "lead_weights";
    const weights = cfg[wkey] || {};
    const wEntries = Object.entries(weights).map(([k,v]) => ({k, v: (v && typeof v === "object" ? v.value : v)})).filter(x => typeof x.v === "number");
    wEntries.sort((a,b) => b.v - a.v);
    const top1 = wEntries[0];
    const tierBits = [`Score ${fmtScore(out.priority_score)}/100 → ${out.priority_tier}`];
    if (thr != null) tierBits.push(`soglia ≥ ${thr}`);
    if (top1) tierBits.push(`fattore con peso maggiore: ${FACTOR_LABELS[top1.k] || top1.k} (${Math.round(top1.v*100)}%)`);
    wrap.appendChild(el("div", {class:"why-tier"}, tierBits.join(" · ")));

    if (entries.length) {
      const ul = el("ul", {class:"why-list"});
      const show = entries.slice(0, 5);
      const hidden = entries.slice(5);
      const renderEntry = (e) => el("li", {class:"why-item sev-" + e.sev},
        el("span", {class:"bullet"}, "•"),
        el("span", {class:"why-lbl"}, e.label),
        e.detail ? el("span", {class:"why-det"}, " — " + e.detail) : null
      );
      show.forEach(e => ul.appendChild(renderEntry(e)));
      if (hidden.length) {
        const moreLi = el("li", {class:"why-more"}, el("button", {class:"linkbtn", type:"button"}, `+ ${hidden.length} altri segnali`));
        moreLi.querySelector("button").addEventListener("click", () => {
          moreLi.remove();
          hidden.forEach(e => ul.appendChild(renderEntry(e)));
        });
        ul.appendChild(moreLi);
      }
      wrap.appendChild(ul);
    }

    if (STATE.lastBreakdown) {
      wrap.appendChild(renderBreakdownPanel(STATE.lastBreakdown));
    }

    return wrap;
  }

  function renderBreakdownPanel(bd) {
    const FACTOR_INFO = {
      urgency:     { lbl:"Urgenza",     desc:"Tempo / criticità (rinnovi, sinistri, scadenze)" },
      value:       { lbl:"Valore",      desc:"Importanza economica (premio, polizze, redditività)" },
      opportunity: { lbl:"Opportunità", desc:"Cross-sell, campagne, preventivi pendenti" },
      recency:     { lbl:"Recency",     desc:"Freschezza dell'ultimo contatto" },
      timing:      { lbl:"Timing",      desc:"Reattività / età del lead" }
    };
    const wrap = el("div", {class:"breakdown-panel"});
    wrap.appendChild(el("details", {class:"acc bd-acc"},
      el("summary", {}, el("span", {class:"msi"}, "calculate"), " Composizione del punteggio"),
      buildBreakdownBody(bd, FACTOR_INFO)
    ));
    return wrap;
  }

  function buildBreakdownBody(bd, FACTOR_INFO) {
    const body = el("div", {class:"body bd-body"});
    body.appendChild(el("div", {class:"bd-intro"}, "Come si arriva al punteggio finale: ogni fattore ottiene un voto (0-100), viene moltiplicato per il suo peso, e si sommano i contributi."));

    // Contribution rows
    const rows = el("div", {class:"bd-rows"});
    (bd.contributions || []).forEach(c => {
      const info = FACTOR_INFO[c.factor] || { lbl: c.factor, desc: "" };
      rows.appendChild(el("div", {class:"bd-row"},
        el("div", {class:"bd-lbl"},
          el("span", {class:"bd-factor-name"}, info.lbl),
          el("span", {class:"bd-factor-desc"}, info.desc)
        ),
        el("div", {class:"bd-bar-wrap"},
          el("div", {class:"bd-bar"},
            el("div", {class:"bd-bar-fill", style:{width: Math.max(0, Math.min(100, c.score)) + "%"}})
          ),
          el("div", {class:"bd-formula"},
            el("span", {class:"bd-score"}, Math.round(c.score)),
            el("span", {class:"bd-mul"}, " × "),
            el("span", {class:"bd-weight"}, Math.round(c.weight * 100) + "%"),
            el("span", {class:"bd-eq"}, " = "),
            el("span", {class:"bd-contrib"}, (Math.round(c.contribution * 10) / 10).toFixed(1) + " punti")
          )
        )
      ));
    });
    body.appendChild(rows);

    // Sum + bonuses + final
    body.appendChild(el("div", {class:"bd-totals"},
      bdTotalRow("Punteggio base (somma dei contributi)", (Math.round(bd.base_score * 10) / 10).toFixed(1), "neutral"),
      (bd.bonuses || []).filter(b => Math.abs(b.value) > 0.001).map(b =>
        bdTotalRow(b.label, (b.value > 0 ? "+" : "") + (Math.round(b.value * 10) / 10).toFixed(1), b.value > 0 ? "pos" : "neg")
      ),
      bd.clamped !== bd.before_clamp ? bdTotalRow("Limitato a 0-100", (Math.round(bd.clamped * 10) / 10).toFixed(1), "neutral") : null,
      bd.churn_override_applied ? bdTotalRow("Override churn → minimo " + Math.round(bd.critical_threshold), Math.round(bd.critical_threshold).toFixed(0), "override") : null,
      bdTotalRow("Punteggio finale", Math.round(bd.final_score).toString(), "final")
    ));

    return body;
  }
  function bdTotalRow(label, value, kind) {
    return el("div", {class:"bd-total-row " + (kind||"")},
      el("span", {class:"bd-total-lbl"}, label),
      el("span", {class:"bd-total-val"}, value)
    );
  }

  function renderActionsList(acts, out) {
    const wrap = el("div", {class:"actions-block"});
    if (!acts.length) { wrap.appendChild(el("div", {class:"muted", style:{fontSize:"12px"}}, "Nessuna azione raccomandata")); return wrap; }
    const primary = acts.filter(a => a.primary);
    const secondary = acts.filter(a => !a.primary);
    const presentTriggers = new Set(out?.triggers || []);
    const card = (a) => {
      const causes = (ACTION_TRIGGERS[a.action_category] || []).filter(t => presentTriggers.has(t));
      const causeLabels = causes.map(c => (TRIG_LABELS[c]?.lbl || c)).slice(0, 3);
      return el("div", {class:"action-card" + (a.primary ? " primary" : "")},
        el("div", {class:"head"},
          el("span", {class:"act-cat"}, a.action_category || ""),
          el("span", {class:"chip"}, el("span", {class:"msi"}, channelIcon(a.recommended_channel)), " " + (a.recommended_channel || "—")),
          a.suggest_appointment ? el("span", {class:"chip"}, el("span", {class:"msi"}, "event"), " appuntamento") : null
        ),
        el("div", {class:"desc"}, a.recommended_action || ""),
        causeLabels.length ? el("div", {class:"caused-by"},
          el("span", {class:"caused-by-lbl"}, "Causata da:"),
          " " + causeLabels.join(" · ")
        ) : null
      );
    };
    if (primary.length) {
      wrap.appendChild(el("div", {class:"actions-section-label primary-label"}, el("span", {class:"msi"}, "flag"), " Azione principale (PRIMARY)"));
      primary.forEach(a => wrap.appendChild(card(a)));
    }
    if (secondary.length) {
      wrap.appendChild(el("div", {class:"actions-section-label"}, `Azioni complementari (SECONDARY) · ${secondary.length}`));
      secondary.forEach(a => wrap.appendChild(card(a)));
    }
    return wrap;
  }

  // ============================== run NBA ==============================
  async function runNBA() {
    if (!STATE.record || !STATE.selected) { toast("Seleziona un'anagrafica", "err"); return; }
    const btn = $("#detail-run"); if (btn) btn.disabled = true;
    try {
      const url = STATE.selected.type === "client" ? "/nba/client/preview?debug=true" : "/nba/lead/preview";
      const body = STATE.selected.type === "client" ? {client: STATE.record, config: STATE.config} : {lead: STATE.record, config: STATE.config};
      const out = await fetchJSON(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      STATE.lastResult = out;
      // Composizione del punteggio (endpoint Tangible Lab)
      try {
        const burl = STATE.selected.type === "client" ? "/lab/breakdown/client" : "/lab/breakdown/lead";
        STATE.lastBreakdown = await fetchJSON(burl, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      } catch { STATE.lastBreakdown = null; }
      const rb = $("#result-box");
      if (rb) {
        rb.innerHTML = "";
        if (out) rb.appendChild(renderResultCard(out));
        else rb.appendChild(el("div", {class:"ml-not-run"}, "Nessun NBA generato (record non eleggibile)."));
      }
      fillProfileGaps();
    } catch (e) {
      STATE.lastResult = null;
      STATE.lastBreakdown = null;
      const rb = $("#result-box");
      if (rb) rb.innerHTML = `<div class="ml-not-run">Errore: ${e.message}</div>`;
      toast(e.message, "err");
    } finally { if (btn) btn.disabled = false; }
  }

  // ============================== A/B compare ==============================
  // Slider-based comparison pane
  const WEIGHT_FACTORS_CLIENT = [
    { k:"urgency",     lbl:"Urgenza",      desc:"Trigger temporali (sinistri aperti, scadenze, rinnovi imminenti)", icon:"bolt" },
    { k:"value",       lbl:"Valore",       desc:"Premio, numero di polizze attive, redditività del cliente",         icon:"euro" },
    { k:"opportunity", lbl:"Opportunità",  desc:"Cross-sell, campagne attive, preventivi in sospeso",                 icon:"diversity_3" },
    { k:"recency",     lbl:"Recency",      desc:"Freschezza del contatto",                                            icon:"schedule" }
  ];
  const WEIGHT_FACTORS_LEAD = [
    { k:"urgency", lbl:"Urgenza", desc:"Quanto è caldo il lead (creazione recente, copertura imminente)", icon:"bolt" },
    { k:"value",   lbl:"Valore",  desc:"Premio del preventivo e potenziale economico",                     icon:"euro" },
    { k:"timing",  lbl:"Timing",  desc:"Reattività e tempistiche del lead (stale / non lavorato)",         icon:"schedule" }
  ];
  function weightFactorsFor(type) { return type === "lead" ? WEIGHT_FACTORS_LEAD : WEIGHT_FACTORS_CLIENT; }

  function buildComparePane() {
    if (!STATE.cmpWeights) initCmpFromConfig();
    const root = el("div", {});

    // Intro
    root.appendChild(el("div", {class:"profile-intro"},
      el("div", {},
        el("div", {class:"profile-title"}, el("span", {class:"msi"}, "tune"), " Confronta con pesature diverse"),
        el("div", {class:"profile-sub"}, "Sposta i cursori per cambiare la ricetta del calcolo, poi premi “Esegui confronto” in basso.")
      ),
      el("div", {class:"profile-actions"},
        el("button", {class:"btn ghost", onclick: resetCmp},
          el("span", {class:"msi"}, "restart_alt"), " Ripristina")
      )
    ));

    // Editor mode tabs
    root.appendChild(el("div", {class:"cmp-mode-tabs"},
      cmpModeBtn("weights",  "tune",               "Pesi"),
      cmpModeBtn("tiers",    "stacked_bar_chart",  "Soglie priorità"),
      cmpModeBtn("churn",    "trending_down",      "Rischio churn"),
      cmpModeBtn("leadthr",  "crisis_alert",       "Soglie lead"),
      cmpModeBtn("boosts",   "north",              "Boost trigger"),
      cmpModeBtn("premiums", "euro",               "Premi medi"),
      cmpModeBtn("json",     "code",               "JSON")
    ));

    // Dynamic editor body
    const editorWrap = el("div", {id:"cmp-editor"});
    root.appendChild(editorWrap);
    renderCmpEditor(editorWrap);

    // Action bar: snapshot picker + run button (azione principale)
    root.appendChild(el("div", {class:"cmp-action-bar"},
      el("div", {class:"cmp-snap-group"},
        el("span", {class:"cmp-snap-lbl"}, "Snapshot:"),
        el("select", {id:"cmp-load-snap", class:"snap-picker"},
          el("option", {value:""}, "— scegli uno snapshot —"),
          Object.keys(STATE.snapshots).sort().map(n => el("option", {value:n}, n))
        ),
        el("button", {class:"btn ghost", onclick: saveCmpSnapshot},
          el("span", {class:"msi"}, "save"), " Salva attuale")
      ),
      el("button", {class:"btn primary-cta", id:"cmp-run", onclick: runCompare},
        el("span", {class:"msi"}, "compare_arrows"), " Esegui confronto")
    ));

    // Results card
    root.appendChild(el("div", {class:"section-block"},
      el("div", {class:"section-head"},
        el("span", {class:"msi section-ico"}, "compare_arrows"),
        el("h3", {}, "Differenze rispetto al baseline")
      ),
      el("div", {class:"section-body", id:"cmp-out"},
        el("div", {class:"ml-not-run"},
          el("span", {class:"msi"}, "play_arrow"),
          " Premi “Esegui confronto” per vedere come cambia la NBA con la nuova ricetta.")
      )
    ));

    // late binding for snapshot loader
    setTimeout(() => {
      const sel = $("#cmp-load-snap");
      if (sel) sel.addEventListener("change", e => {
        const name = e.target.value; if (!name) return;
        const snap = STATE.snapshots[name];
        if (snap) applyCmpFromConfig(snap);
      });
    }, 0);

    return root;
  }

  function cmpModeBtn(mode, icon, label) {
    const b = el("button", {class:"cmp-mode-btn" + (STATE.cmpMode === mode ? " active" : ""), "data-mode":mode},
      el("span", {class:"msi"}, icon), " " + label);
    b.addEventListener("click", () => {
      STATE.cmpMode = mode;
      document.querySelectorAll(".cmp-mode-btn").forEach(x => x.classList.toggle("active", x.dataset.mode === mode));
      renderCmpEditor(document.getElementById("cmp-editor"));
    });
    return b;
  }

  function renderCmpEditor(wrap) {
    if (!wrap) return;
    wrap.innerHTML = "";
    switch (STATE.cmpMode) {
      case "weights":  wrap.appendChild(buildWeightsEditor()); break;
      case "tiers":    wrap.appendChild(buildTiersEditor()); break;
      case "churn":    wrap.appendChild(buildChurnEditor()); break;
      case "leadthr":  wrap.appendChild(buildLeadThrEditor()); break;
      case "boosts":   wrap.appendChild(buildBoostsEditor()); break;
      case "premiums": wrap.appendChild(buildPremiumsEditor()); break;
      case "json":     wrap.appendChild(buildJsonEditor()); break;
      default:         wrap.appendChild(buildWeightsEditor());
    }
  }

  function buildWeightsEditor() {
    const type = STATE.selected?.type || "client";
    const factors = weightFactorsFor(type);
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "tune"),
      el("h3", {}, "Pesi del calcolo · " + (type === "lead" ? "Lead" : "Cliente")),
      el("span", {class:"section-hint"}, "Quanto pesa ciascun fattore (la somma viene normalizzata a 100%)")
    ));
    const body = el("div", {class:"section-body"});
    factors.forEach(f => {
      if (STATE.cmpWeights[f.k] == null) STATE.cmpWeights[f.k] = 1 / factors.length;
      const v = STATE.cmpWeights[f.k];
      const pct = Math.round(v * 100);
      const row = el("div", {class:"slider-row"});
      row.appendChild(el("div", {class:"slider-meta"},
        el("div", {class:"slider-label"},
          el("span", {class:"msi"}, f.icon),
          el("span", {class:"slider-lbl-text"}, f.lbl),
          el("span", {class:"slider-val", "data-out":"w-"+f.k}, pct + "%")
        ),
        el("div", {class:"slider-desc"}, f.desc)
      ));
      const sl = el("input", {type:"range", min:"0", max:"100", step:"1", value:String(pct), class:"slider", "data-key":"w-"+f.k});
      sl.style.setProperty("--p", pct + "%");
      sl.addEventListener("input", () => {
        const newPct = Number(sl.value);
        STATE.cmpWeights[f.k] = newPct / 100;
        row.querySelector('[data-out="w-'+f.k+'"]').textContent = newPct + "%";
        sl.style.setProperty("--p", newPct + "%");
        updateWeightsSum();
      });
      row.appendChild(sl);
      body.appendChild(row);
    });
    // sum indicator
    body.appendChild(el("div", {class:"weights-sum", id:"weights-sum"}));
    updateWeightsSumLater();
    card.appendChild(body);
    return card;
  }

  function updateWeightsSum() {
    const el = document.getElementById("weights-sum");
    if (!el) return;
    const type = STATE.selected?.type || "client";
    const factors = weightFactorsFor(type);
    const s = factors.reduce((acc, f) => acc + (STATE.cmpWeights[f.k] || 0), 0) * 100;
    const sr = Math.round(s);
    const isHundred = Math.abs(sr - 100) <= 1;
    el.innerHTML = "";
    el.appendChild(document.createElement("span"));
    el.firstChild.className = "msi";
    el.firstChild.textContent = isHundred ? "check_circle" : "balance";
    el.appendChild(document.createTextNode(" Somma corrente: " + sr + "% " + (isHundred ? "(perfetta)" : "— verrà normalizzata a 100% in fase di calcolo")));
    el.classList.toggle("ok", isHundred);
    el.classList.toggle("warn", !isHundred);
  }
  function updateWeightsSumLater() { setTimeout(updateWeightsSum, 0); }

  function buildTiersEditor() {
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "stacked_bar_chart"),
      el("h3", {}, "Soglie di priorità"),
      el("span", {class:"section-hint"}, "Score minimo per assegnare il tier corrispondente (0–100)")
    ));
    const body = el("div", {class:"section-body"});
    const TIERS = [
      { k:"CRITICAL", lbl:"CRITICAL", desc:"Score ≥ N → Priorità massima",  color:"#E80E3F" },
      { k:"HIGH",     lbl:"HIGH",     desc:"Score ≥ N → Priorità alta",     color:"#F59E0B" },
      { k:"MEDIUM",   lbl:"MEDIUM",   desc:"Score ≥ N → Priorità media (sotto: LOW)", color:"#00E0CA" }
    ];
    TIERS.forEach(t => {
      const v = STATE.cmpTiers[t.k];
      const row = el("div", {class:"slider-row"});
      row.appendChild(el("div", {class:"slider-meta"},
        el("div", {class:"slider-label"},
          el("span", {class:"tier-dot", style:{background:t.color}}),
          el("span", {class:"slider-lbl-text"}, t.lbl),
          el("span", {class:"slider-val", "data-out":"t-"+t.k}, v)
        ),
        el("div", {class:"slider-desc"}, t.desc)
      ));
      const sl = el("input", {type:"range", min:"0", max:"100", step:"1", value:String(v), class:"slider", "data-key":"t-"+t.k});
      sl.style.setProperty("--p", v + "%");
      sl.addEventListener("input", () => {
        const newV = Number(sl.value);
        STATE.cmpTiers[t.k] = newV;
        row.querySelector('[data-out="t-'+t.k+'"]').textContent = newV;
        sl.style.setProperty("--p", newV + "%");
        updateTiersPreview();
      });
      row.appendChild(sl);
      body.appendChild(row);
    });
    // preview bar
    body.appendChild(el("div", {class:"tiers-preview", id:"tiers-preview"}));
    setTimeout(updateTiersPreview, 0);
    card.appendChild(body);
    return card;
  }
  function updateTiersPreview() {
    const box = document.getElementById("tiers-preview");
    if (!box) return;
    const t = STATE.cmpTiers;
    box.innerHTML = "";
    box.appendChild(el("div", {class:"tprev-bar"},
      el("div", {class:"tprev-seg low",  style:{flex: String(t.MEDIUM)}}, "LOW 0–"+(t.MEDIUM-1)),
      el("div", {class:"tprev-seg med",  style:{flex: String(t.HIGH - t.MEDIUM)}}, "MED "+t.MEDIUM+"–"+(t.HIGH-1)),
      el("div", {class:"tprev-seg high", style:{flex: String(t.CRITICAL - t.HIGH)}}, "HIGH "+t.HIGH+"–"+(t.CRITICAL-1)),
      el("div", {class:"tprev-seg crit", style:{flex: String(100 - t.CRITICAL)}}, "CRIT "+t.CRITICAL+"+")
    ));
  }

  // Generic slider group — used by churn, lead-thr, boosts, premiums
  function buildSliderGroup({ title, icon, hint, stateKey, fields, fmt }) {
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, icon),
      el("h3", {}, title),
      hint ? el("span", {class:"section-hint"}, hint) : null
    ));
    const body = el("div", {class:"section-body"});
    fields.forEach(f => {
      const obj = STATE[stateKey];
      const cur = obj[f.k];
      const minv = f.min ?? 0, maxv = f.max ?? 100, step = f.step ?? 1;
      const pct = ((cur - minv) / (maxv - minv)) * 100;
      const row = el("div", {class:"slider-row"});
      row.appendChild(el("div", {class:"slider-meta"},
        el("div", {class:"slider-label"},
          f.icon ? el("span", {class:"msi"}, f.icon) : null,
          el("span", {class:"slider-lbl-text"}, f.lbl),
          el("span", {class:"slider-val", "data-out":stateKey+"-"+f.k}, (fmt||defaultFmt)(cur, f))
        ),
        f.desc ? el("div", {class:"slider-desc"}, f.desc) : null
      ));
      const sl = el("input", {type:"range", min:String(minv), max:String(maxv), step:String(step), value:String(cur), class:"slider"});
      sl.style.setProperty("--p", pct + "%");
      sl.addEventListener("input", () => {
        const newV = step < 1 ? parseFloat(sl.value) : Number(sl.value);
        STATE[stateKey][f.k] = newV;
        const newPct = ((newV - minv) / (maxv - minv)) * 100;
        sl.style.setProperty("--p", newPct + "%");
        row.querySelector('[data-out="'+stateKey+'-'+f.k+'"]').textContent = (fmt||defaultFmt)(newV, f);
      });
      row.appendChild(sl);
      body.appendChild(row);
    });
    card.appendChild(body);
    return card;
  }
  function defaultFmt(v, f) {
    if (f.unit === "%") return Math.round(v * 100) + "%";
    if (f.unit) return v + " " + f.unit;
    return String(v);
  }

  function buildChurnEditor() {
    return buildSliderGroup({
      title: "Rischio churn",
      icon: "trending_down",
      hint: "Quando un cliente è considerato a rischio abbandono",
      stateKey: "cmpChurn",
      fields: [
        { k:"HIGH_CHURN_THRESHOLD",          lbl:"Rischio alto",                 desc:"Churn rate ≥ valore → trigger HIGH_CHURN_RISK",                 min:0, max:1, step:0.01, unit:"%", icon:"warning" },
        { k:"SINGLE_POLICY_CHURN_THRESHOLD", lbl:"Rischio con singola polizza",  desc:"Cliente con 1 sola polizza e churn ≥ valore → flag a rischio",  min:0, max:1, step:0.01, unit:"%", icon:"shield" },
        { k:"CHURN_OVERRIDE_RENEWAL_DAYS",   lbl:"Annulla churn se rinnovo entro N giorni", desc:"Se la polizza si rinnova entro N giorni, l'urgenza churn è soppressa", min:0, max:365, step:1, unit:"giorni", icon:"event_repeat" }
      ]
    });
  }
  function buildLeadThrEditor() {
    return buildSliderGroup({
      title: "Soglie qualificazione Lead",
      icon: "crisis_alert",
      hint: "Quando un lead è considerato nuovo / stale / alto valore",
      stateKey: "cmpLeadThr",
      fields: [
        { k:"NO_CONTACT_DAYS_THRESHOLD",         lbl:"Contatto overdue (cliente)", desc:"Cliente senza contatto da ≥ N giorni → CONTACT_OVERDUE", min:0, max:365, step:1, unit:"giorni", icon:"phone_disabled" },
        { k:"LEAD_NEW_HOURS_THRESHOLD",          lbl:"Lead nuovo",                 desc:"Lead creato ≤ N ore fa → NEW_LEAD",                       min:0, max:168, step:1, unit:"ore",    icon:"new_releases" },
        { k:"LEAD_STALE_DAYS_THRESHOLD",         lbl:"Lead stale",                 desc:"Lead senza risposta da ≥ N giorni → STALE_LEAD",          min:0, max:30,  step:1, unit:"giorni", icon:"hourglass_disabled" },
        { k:"LEAD_COVERAGE_START_SOON_DAYS",     lbl:"Copertura imminente",         desc:"Inizio copertura ≤ N giorni → COVERAGE_START_SOON",       min:0, max:60,  step:1, unit:"giorni", icon:"event" },
        { k:"LEAD_HIGH_VALUE_PREMIUM_THRESHOLD", lbl:"Lead alto valore",            desc:"Premio preventivo ≥ €N → HIGH_VALUE_QUOTE",               min:0, max:5000, step:50, unit:"€",   icon:"euro" }
      ]
    });
  }
  function buildBoostsEditor() {
    return buildSliderGroup({
      title: "Boost dei trigger",
      icon: "north",
      hint: "Quanto un trigger spinge l'urgenza o l'opportunità (0–50)",
      stateKey: "cmpBoosts",
      fields: [
        { k:"OPEN_CASE_URGENCY_BOOST",           lbl:"Sinistri / reclami aperti", desc:"Aggiunge urgenza quando ci sono casi aperti",   min:0, max:50, step:1, icon:"gavel" },
        { k:"ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST", lbl:"Campagne attive",            desc:"Aggiunge opportunità per campagne in corso",     min:0, max:50, step:1, icon:"campaign" },
        { k:"VIVA_EXPIRING_OPPORTUNITY_BOOST",   lbl:"VIVA punti in scadenza",     desc:"Aggiunge opportunità quando ci sono punti VIVA in scadenza", min:0, max:50, step:1, icon:"loyalty" },
        { k:"PENDING_QUOTE_OPPORTUNITY_BOOST",   lbl:"Preventivi pendenti",        desc:"Aggiunge opportunità per preventivi non chiusi", min:0, max:50, step:1, icon:"request_quote" }
      ]
    });
  }
  function buildPremiumsEditor() {
    return buildSliderGroup({
      title: "Premi medi di riferimento",
      icon: "euro",
      hint: "Medie di mercato usate per calibrare il valore relativo del portafoglio",
      stateKey: "cmpPremiums",
      fields: [
        { k:"CASA",                              lbl:"CASA",                desc:"Premio medio polizza casa",                 min:0, max:5000, step:50, unit:"€", icon:"home" },
        { k:"INFORTUNI",                         lbl:"INFORTUNI",           desc:"Premio medio infortuni",                    min:0, max:5000, step:50, unit:"€", icon:"healing" },
        { k:"MALATTIA",                          lbl:"MALATTIA",            desc:"Premio medio malattia",                     min:0, max:5000, step:50, unit:"€", icon:"medical_services" },
        { k:"VITA_PROTEZIONE",                   lbl:"VITA PROTEZIONE",     desc:"Premio medio vita/protezione",              min:0, max:5000, step:50, unit:"€", icon:"favorite" },
        { k:"PREVIDENZA_COMPLEMENTARE",          lbl:"PREVIDENZA COMPL.",   desc:"Premio medio previdenza complementare",     min:0, max:5000, step:50, unit:"€", icon:"savings" },
        { k:"RESPONSABILITA_PROFESSIONALE",      lbl:"RC PROFESSIONALE",    desc:"Premio medio responsabilità professionale", min:0, max:5000, step:50, unit:"€", icon:"work" },
        { k:"VITA_PRIVATA_RESPONSABILITA_CIVILE", lbl:"RC VITA PRIVATA",    desc:"Premio medio RC vita privata",              min:0, max:5000, step:10, unit:"€", icon:"shield" },
        { k:"VITA_PRIVATA_ANIMALI_DOMESTICI",    lbl:"ANIMALI DOMESTICI",   desc:"Premio medio animali domestici",            min:0, max:5000, step:10, unit:"€", icon:"pets" },
        { k:"VITA_PRIVATA_TUTELA_LEGALE",        lbl:"TUTELA LEGALE",       desc:"Premio medio tutela legale",                min:0, max:5000, step:10, unit:"€", icon:"gavel" },
        { k:"VITA_PRIVATA_MICROMOBILITA",        lbl:"MICROMOBILITÀ",       desc:"Premio medio micromobilità",                min:0, max:5000, step:10, unit:"€", icon:"electric_scooter" },
        { k:"VITA_PRIVATA_VIAGGI",               lbl:"VIAGGI",              desc:"Premio medio viaggi",                       min:0, max:5000, step:10, unit:"€", icon:"flight" }
      ]
    });
  }

  function buildJsonEditor() {
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "code"),
      el("h3", {}, "JSON avanzato"),
      el("span", {class:"section-hint"}, "Per utenti tecnici — modifica direttamente lo schema completo")
    ));
    const body = el("div", {class:"section-body"});
    body.appendChild(el("button", {class:"btn ghost", style:{marginBottom:"8px"}, onclick: () => { STATE.cmpJson = JSON.stringify(STATE.config, null, 2); document.getElementById("cmp-cfg").value = STATE.cmpJson; }},
      el("span", {class:"msi"}, "download"), " Carica config corrente"));
    const ta = el("textarea", {class:"json-edit", id:"cmp-cfg", placeholder:"JSON con la stessa struttura di /config"});
    ta.value = STATE.cmpJson || JSON.stringify(STATE.config, null, 2);
    ta.addEventListener("input", () => { STATE.cmpJson = ta.value; });
    body.appendChild(ta);
    card.appendChild(body);
    return card;
  }

  function resetCmp() {
    initCmpFromConfig();
    renderCmpEditor(document.getElementById("cmp-editor"));
    toast("Pesi e soglie ripristinati dalla config corrente", "ok");
  }

  function applyCmpFromConfig(cfg) {
    const getV = (x) => (x && typeof x === "object" && "value" in x) ? x.value : x;
    const type = STATE.selected?.type || "client";
    const wkey = type === "lead" ? "lead_weights" : "client_weights";
    const w = cfg[wkey] || {};
    STATE.cmpWeights = STATE.cmpWeights || {};
    weightFactorsFor(type).forEach(f => {
      if (getV(w[f.k]) != null) STATE.cmpWeights[f.k] = getV(w[f.k]);
    });
    const t = cfg.tiers || {};
    if (getV(t.CRITICAL) != null) STATE.cmpTiers.CRITICAL = getV(t.CRITICAL);
    if (getV(t.HIGH)     != null) STATE.cmpTiers.HIGH     = getV(t.HIGH);
    if (getV(t.MEDIUM)   != null) STATE.cmpTiers.MEDIUM   = getV(t.MEDIUM);
    const thr = cfg.thresholds || {};
    Object.keys(STATE.cmpChurn || {}).forEach(k => { if (getV(thr[k]) != null) STATE.cmpChurn[k] = getV(thr[k]); });
    Object.keys(STATE.cmpLeadThr || {}).forEach(k => { if (getV(thr[k]) != null) STATE.cmpLeadThr[k] = getV(thr[k]); });
    Object.keys(STATE.cmpBoosts || {}).forEach(k => { if (getV(thr[k]) != null) STATE.cmpBoosts[k] = getV(thr[k]); });
    const ap = cfg.avg_premiums || {};
    Object.keys(STATE.cmpPremiums || {}).forEach(k => { if (getV(ap[k]) != null) STATE.cmpPremiums[k] = getV(ap[k]); });
    STATE.cmpJson = JSON.stringify(cfg, null, 2);
    renderCmpEditor(document.getElementById("cmp-editor"));
  }

  function buildCmpConfig() {
    if (STATE.cmpMode === "json") {
      try { return JSON.parse(STATE.cmpJson); } catch { return null; }
    }
    const cfg = deepClone(STATE.config || {});
    const type = "client";
    const wkey = type === "lead" ? "lead_weights" : "client_weights";
    cfg[wkey] = cfg[wkey] || {};
    weightFactorsFor(type).forEach(f => {
      cfg[wkey][f.k] = Object.assign({}, cfg[wkey][f.k] || {min:0,max:1,step:0.01}, { value: STATE.cmpWeights[f.k] });
    });
    cfg.tiers = cfg.tiers || {};
    ["CRITICAL","HIGH","MEDIUM"].forEach(k => {
      cfg.tiers[k] = Object.assign({}, cfg.tiers[k] || {min:0,max:100,step:1}, { value: STATE.cmpTiers[k] });
    });
    cfg.thresholds = cfg.thresholds || {};
    const writeThr = (k, v, def) => {
      const node = cfg.thresholds[k] || def;
      cfg.thresholds[k] = Object.assign({}, node, { value: v });
    };
    Object.entries(STATE.cmpChurn   || {}).forEach(([k,v]) => writeThr(k, v, {min:0,max:1,step:0.01}));
    Object.entries(STATE.cmpLeadThr || {}).forEach(([k,v]) => writeThr(k, v, {min:0,max:365,step:1}));
    Object.entries(STATE.cmpBoosts  || {}).forEach(([k,v]) => writeThr(k, v, {min:0,max:50,step:1}));
    cfg.avg_premiums = cfg.avg_premiums || {};
    Object.entries(STATE.cmpPremiums || {}).forEach(([k,v]) => {
      cfg.avg_premiums[k] = Object.assign({}, cfg.avg_premiums[k] || {min:0,max:5000,step:50}, { value: v });
    });
    return cfg;
  }

  function saveCmpSnapshot() {
    const cfg = buildCmpConfig();
    if (!cfg) { toast("Configurazione non valida", "err"); return; }
    const name = prompt("Nome snapshot:"); if (!name) return;
    STATE.snapshots[name] = cfg;
    localStorage.setItem(LS_SNAP, JSON.stringify(STATE.snapshots));
    const sel = document.getElementById("cmp-load-snap");
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">— scegli uno snapshot —</option>' + Object.keys(STATE.snapshots).sort().map(n => `<option value="${n}">${n}</option>`).join("");
      sel.value = cur || "";
    }
    toast(`Snapshot "${name}" salvato`, "ok");
  }

  async function runCompare() {
    if (!STATE.lastResult) { toast("Esegui prima NBA per avere un baseline", "err"); return; }
    const cfgB = buildCmpConfig();
    if (!cfgB) { toast("Configurazione non valida", "err"); return; }
    const url = STATE.selected.type === "client" ? "/nba/client/preview?debug=true" : "/nba/lead/preview";
    const body = STATE.selected.type === "client" ? {client: STATE.record, config: cfgB} : {lead: STATE.record, config: cfgB};
    const btn = $("#cmp-run"); btn.disabled = true;
    try {
      const outB = await fetchJSON(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      renderCompareDiff(STATE.lastResult, outB);
    } catch (e) { toast(e.message, "err"); } finally { btn.disabled = false; }
  }
  function renderCompareDiff(a, b) {
    const out = $("#cmp-out"); out.innerHTML = "";
    if (!a || !b) { out.appendChild(el("div", {class:"ml-not-run"}, "Manca uno dei due risultati")); return; }

    const dScore = (b.priority_score||0) - (a.priority_score||0);
    const dRound = Math.round(dScore * 10) / 10;
    const tierChg = a.priority_tier !== b.priority_tier;
    const stratChg = a.strategic_category !== b.strategic_category;

    const trA = new Set(a.triggers || []), trB = new Set(b.triggers || []);
    const trAdded   = [...trB].filter(t => !trA.has(t));
    const trRemoved = [...trA].filter(t => !trB.has(t));
    const trSame    = [...trA].filter(t => trB.has(t));

    const aActs = (a.recommended_actions||[]).map(x => `${x.action_category}: ${x.recommended_action}`);
    const bActs = (b.recommended_actions||[]).map(x => `${x.action_category}: ${x.recommended_action}`);
    const aSet  = new Set(aActs), bSet = new Set(bActs);
    const actAdded   = bActs.filter(x => !aSet.has(x));
    const actRemoved = aActs.filter(x => !bSet.has(x));
    const actSame    = aActs.filter(x => bSet.has(x));

    const totalChanges = (dRound !== 0 ? 1 : 0) + (tierChg ? 1 : 0) + (stratChg ? 1 : 0)
                       + trAdded.length + trRemoved.length + actAdded.length + actRemoved.length;

    if (totalChanges === 0) {
      out.appendChild(el("div", {class:"cmp-empty-state"},
        el("span", {class:"msi"}, "check_circle"),
        el("div", {},
          el("div", {class:"cmp-empty-title"}, "La nuova pesatura produce lo stesso risultato del baseline"),
          el("div", {class:"cmp-empty-sub"}, "Nessuna differenza significativa su score, tier, trigger o azioni. Prova a spostare i cursori più decisamente o a cambiare gruppo di parametri.")
        )
      ));
      return;
    }

    const bits = [];
    if (dRound > 0) bits.push("score sale di +" + dRound + " punti");
    else if (dRound < 0) bits.push("score scende di " + dRound + " punti");
    if (tierChg) bits.push(`tier passa da ${a.priority_tier} a ${b.priority_tier}`);
    if (stratChg) bits.push(`strategia passa da ${STRATEGY_LABELS[a.strategic_category] || a.strategic_category} a ${STRATEGY_LABELS[b.strategic_category] || b.strategic_category}`);
    if (trAdded.length || trRemoved.length) {
      const parts = [];
      if (trAdded.length)   parts.push(trAdded.length + " in più");
      if (trRemoved.length) parts.push(trRemoved.length + " in meno");
      bits.push("trigger: " + parts.join(", "));
    }
    if (actAdded.length || actRemoved.length) {
      const parts = [];
      if (actAdded.length)   parts.push(actAdded.length + " in più");
      if (actRemoved.length) parts.push(actRemoved.length + " in meno");
      bits.push("azioni: " + parts.join(", "));
    }
    out.appendChild(el("div", {class:"cmp-summary " + (dRound > 0 ? "up" : dRound < 0 ? "down" : "neutral")},
      el("span", {class:"msi"}, dRound > 0 ? "trending_up" : dRound < 0 ? "trending_down" : "swap_horiz"),
      el("div", {}, "Cosa cambia rispetto al baseline: " + bits.join("; ") + ".")
    ));

    out.appendChild(renderCmpScoreCard(a, b, dRound, tierChg, stratChg));
    out.appendChild(renderCmpDiffCard({
      title:"Trigger attivati", icon:"bolt",
      added:trAdded, removed:trRemoved, same:trSame,
      labelOf: t => TRIG_LABELS[t]?.lbl || t,
      emptyAddedTxt:"Nessun nuovo trigger",
      emptyRemovedTxt:"Nessun trigger sparito",
      emptySameTxt:"Nessun trigger in comune"
    }));
    out.appendChild(renderCmpDiffCard({
      title:"Azioni raccomandate", icon:"checklist",
      added:actAdded, removed:actRemoved, same:actSame,
      labelOf: x => x,
      emptyAddedTxt:"Nessuna nuova azione",
      emptyRemovedTxt:"Nessuna azione tolta",
      emptySameTxt:"Nessuna azione in comune"
    }));
  }

  function renderCmpScoreCard(a, b, dRound, tierChg, stratChg) {
    const card = el("div", {class:"cmp-card"});
    card.appendChild(el("div", {class:"cmp-card-title"},
      el("span", {class:"msi"}, "compare_arrows"),
      " Score, tier e strategia"
    ));
    const sa = a.priority_score == null ? "—" : Math.round(a.priority_score);
    const sb = b.priority_score == null ? "—" : Math.round(b.priority_score);
    card.appendChild(el("div", {class:"cmp-score-row"},
      el("div", {class:"cmp-side"},
        el("div", {class:"cmp-side-lbl"}, "Baseline (corrente)"),
        el("div", {class:"cmp-score-big " + (a.priority_tier || "LOW")}, String(sa)),
        el("div", {class:"cmp-side-meta"},
          el("span", {class:`tier ${a.priority_tier||"LOW"}`}, a.priority_tier || "—"),
          el("span", {class:"chip"}, STRATEGY_LABELS[a.strategic_category] || a.strategic_category || "—")
        )
      ),
      el("div", {class:"cmp-arrow"},
        el("span", {class:"msi"}, "east"),
        dRound !== 0 ? el("div", {class:"cmp-delta " + (dRound > 0 ? "pos" : "neg")},
          (dRound > 0 ? "+" : "") + dRound + " punti"
        ) : el("div", {class:"cmp-delta zero"}, "stesso punteggio")
      ),
      el("div", {class:"cmp-side"},
        el("div", {class:"cmp-side-lbl"}, "Con nuova pesatura"),
        el("div", {class:"cmp-score-big " + (b.priority_tier || "LOW")}, String(sb)),
        el("div", {class:"cmp-side-meta"},
          el("span", {class:`tier ${b.priority_tier||"LOW"}` + (tierChg ? " chg" : "")}, b.priority_tier || "—"),
          el("span", {class:"chip" + (stratChg ? " chg" : "")}, STRATEGY_LABELS[b.strategic_category] || b.strategic_category || "—")
        )
      )
    ));
    return card;
  }

  function renderCmpDiffCard({ title, icon, added, removed, same, labelOf, emptyAddedTxt, emptyRemovedTxt, emptySameTxt }) {
    const card = el("div", {class:"cmp-card"});
    card.appendChild(el("div", {class:"cmp-card-title"},
      el("span", {class:"msi"}, icon),
      " " + title
    ));
    const renderCol = (kind, items, emptyTxt) => {
      const meta = {
        added:   { lbl:"Nuovi (presenti solo con la nuova pesatura)", ico:"add_circle" },
        removed: { lbl:"Spariti (presenti solo nel baseline)",        ico:"remove_circle" },
        same:    { lbl:"Invariati (in entrambi)",                      ico:"radio_button_unchecked" }
      }[kind];
      const col = el("div", {class:"diff-col " + kind});
      col.appendChild(el("div", {class:"diff-col-head"},
        el("span", {class:"msi"}, meta.ico),
        el("span", {class:"diff-col-lbl"}, meta.lbl),
        el("span", {class:"diff-col-cnt"}, String(items.length))
      ));
      const body = el("div", {class:"diff-col-body"});
      if (!items.length) {
        body.appendChild(el("div", {class:"diff-col-empty"}, emptyTxt));
      } else {
        const maxShow = 6;
        const show = items.slice(0, maxShow);
        const hidden = items.slice(maxShow);
        show.forEach(x => body.appendChild(el("div", {class:"diff-pill"}, labelOf(x))));
        if (hidden.length) {
          const more = el("button", {class:"linkbtn", type:"button"}, `+ ${hidden.length} altri`);
          more.addEventListener("click", () => {
            more.remove();
            hidden.forEach(x => body.appendChild(el("div", {class:"diff-pill"}, labelOf(x))));
          });
          body.appendChild(more);
        }
      }
      col.appendChild(body);
      return col;
    };
    card.appendChild(el("div", {class:"cmp-diff-grid"},
      renderCol("added", added, emptyAddedTxt),
      renderCol("removed", removed, emptyRemovedTxt),
      renderCol("same", same, emptySameTxt)
    ));
    return card;
  }

  // ============================== saved cases ==============================
  async function loadSavedFromAPI() {
    try {
      const cases = await fetchJSON("/lab/api/cases");
      STATE.saved = cases.map(c => ({
        id: c.id, name: c.name, type: c.type, record: c.record,
        notes: c.notes || "", shared: !!c.shared,
        owner_id: c.owner_id, owner_username: c.owner_username,
        createdAt: c.created_at, updatedAt: c.updated_at
      }));
    } catch { STATE.saved = []; }
  }
  // saveSavedToLS è no-op: ogni mutazione passa per API (vedi showSaveDialog/deleteCurrentSaved).
  function saveSavedToLS() { /* persisted server-side */ }
  function buildReviewBar(it) {
    const bar = el("div", {class:"review-bar"});
    const current = getReview(it);
    bar.appendChild(el("div", {class:"review-bar-left"},
      el("span", {class:"review-bar-lbl"},
        el("span", {class:"msi"}, "rate_review"),
        " Giudizio operatore:"),
      ["ok","ko","unsure"].map(j => {
        const m = REVIEW_META[j];
        const active = current?.judgement === j;
        const b = el("button", {class:"review-btn" + (active ? " active " + j : ""), "data-j":j, title:m.lbl},
          el("span", {class:"msi"}, m.icon), " " + m.lbl);
        b.addEventListener("click", async () => {
          await setReview(it, active ? null : j);
          STATE.items = buildItems(); updateFolderCounts(); renderListPane();
          const newBar = buildReviewBar(it);
          bar.parentNode.replaceChild(newBar, bar);
          toast(active ? "Giudizio rimosso" : `Marcato come "${m.lbl}"`, "ok");
        });
        return b;
      })
    ));
    if (current) {
      bar.appendChild(el("div", {class:"review-bar-right"},
        el("span", {class:"review-ts"}, "Revisionato il " + new Date(current.reviewedAt).toLocaleString())
      ));
    }
    // Thread commenti (caricato da API)
    bar.appendChild(buildCommentsThread(it));
    return bar;
  }

  function buildCommentsThread(it) {
    // Mostriamo solo un trigger che apre il drawer laterale.
    // Aggiornamento del badge "(N)" via refresh asincrono.
    const btn = el("button", {class:"comments-trigger", type:"button"},
      el("span", {class:"msi"}, "chat"),
      el("span", {class:"comments-trigger-lbl"}, "Note"),
      el("span", {class:"comments-trigger-count", "data-comments-count":""}, "")
    );
    btn.addEventListener("click", () => openCommentsDrawer(it));
    // Conteggio iniziale
    refreshCommentsCount(it, btn);
    return btn;
  }

  async function refreshCommentsCount(it, btnEl) {
    try {
      const k = reviewKey(it);
      const data = await fetchJSON(`/lab/api/reviews/${encodeURIComponent(k)}`);
      const n = (data.comments || []).length;
      const span = btnEl.querySelector("[data-comments-count]");
      if (span) span.textContent = n ? `${n}` : "0";
      btnEl.classList.toggle("has-comments", n > 0);
    } catch { /* silenzioso */ }
  }

  function openCommentsDrawer(it) {
    // chiudi eventuale drawer aperto
    document.querySelector(".comments-drawer-bg")?.remove();

    const bg = el("div", {class:"comments-drawer-bg"});
    const drawer = el("aside", {class:"comments-drawer", role:"dialog", "aria-label":"Note"});

    // header
    const head = el("div", {class:"cdrawer-head"},
      el("div", {class:"cdrawer-title"},
        el("span", {class:"msi"}, "chat"),
        " Note"
      ),
      el("button", {class:"cdrawer-close", type:"button", title:"Chiudi"},
        el("span", {class:"msi"}, "close")
      )
    );
    head.querySelector(".cdrawer-close").addEventListener("click", () => bg.remove());
    drawer.appendChild(head);

    // contesto (mostra a quale anagrafica si riferisce)
    drawer.appendChild(el("div", {class:"cdrawer-context"},
      el("span", {class:"chip"}, (it.type === "client" ? "Cliente" : "Lead") + " " + it.id)
    ));

    // lista commenti
    const list = el("div", {class:"comments-list", id:"comments-list-drawer"});
    drawer.appendChild(list);

    // form aggiunta in fondo
    const form = el("div", {class:"comment-add cdrawer-form"});
    const textarea = el("textarea", {placeholder:"Scrivi una nota…", rows:"2"});
    const sendBtn = el("button", {class:"btn", onclick: async () => {
      const body = textarea.value.trim();
      if (!body) return;
      try {
        const k = reviewKey(it);
        await fetchJSON(`/lab/api/comments/${encodeURIComponent(k)}`, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({body})});
        textarea.value = "";
        await refreshComments(it, list);
        // aggiorna il badge nella review-bar
        document.querySelectorAll(".comments-trigger").forEach(b => refreshCommentsCount(it, b));
      } catch (e) { toast(e.message, "err"); }
    }}, el("span", {class:"msi"}, "send"), " Invia");
    form.appendChild(textarea);
    form.appendChild(sendBtn);
    drawer.appendChild(form);

    bg.appendChild(drawer);
    // click backdrop (fuori dal drawer) → chiudi
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
    // animazione slide-in
    requestAnimationFrame(() => bg.classList.add("open"));

    // ESC chiude
    const esc = (e) => { if (e.key === "Escape") { bg.remove(); document.removeEventListener("keydown", esc); } };
    document.addEventListener("keydown", esc);

    // carica i commenti
    refreshComments(it, list).then(() => {
      // se il delete o edit cambia il conteggio, aggiorna il chip esterno
      document.querySelectorAll(".comments-trigger").forEach(b => refreshCommentsCount(it, b));
    });
    setTimeout(() => textarea.focus(), 250);
  }

  async function refreshComments(it, listEl) {
    listEl.innerHTML = '<div class="muted" style="font-size:11px;padding:6px 0">Caricamento…</div>';
    try {
      const k = reviewKey(it);
      const data = await fetchJSON(`/lab/api/reviews/${encodeURIComponent(k)}`);
      const comments = data.comments || [];
      STATE.commentsByTarget[k] = comments;
      // Aggiorna il badge nella review-bar
      document.querySelectorAll(".comments-trigger").forEach(b => {
        const span = b.querySelector("[data-comments-count]");
        if (span) span.textContent = String(comments.length);
        b.classList.toggle("has-comments", comments.length > 0);
      });
      listEl.innerHTML = "";
      if (!comments.length) {
        listEl.appendChild(el("div", {class:"muted", style:{fontSize:"11px",padding:"6px 0"}}, "Nessuna nota ancora."));
        return;
      }
      comments.forEach(c => {
        const isMine = c.user_id === STATE.me?.id;
        const canEdit = isMine || STATE.me?.role === "admin";
        const item = el("div", {class:"comment-item" + (isMine ? " mine" : "")});
        item.appendChild(el("div", {class:"comment-meta"},
          el("span", {class:"comment-time"}, new Date(c.created_at).toLocaleString()),
          c.created_at !== c.updated_at ? el("span", {class:"comment-edited"}, " · modificato") : null,
          canEdit ? el("div", {class:"comment-actions"},
            el("button", {class:"linkbtn", onclick: () => editCommentInline(c, item, it, listEl)}, "Modifica"),
            " · ",
            el("button", {class:"linkbtn", onclick: () => deleteComment(c, it, listEl)}, "Elimina")
          ) : null
        ));
        item.appendChild(el("div", {class:"comment-body"}, c.body));
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.innerHTML = `<div class="muted" style="font-size:11px;padding:6px 0">Errore: ${e.message}</div>`;
    }
  }

  function editCommentInline(c, itemEl, it, listEl) {
    const body = itemEl.querySelector(".comment-body");
    const original = c.body;
    const ta = el("textarea", {rows:"2"});
    ta.value = original;
    const save = el("button", {class:"btn", style:{padding:"4px 10px",fontSize:"11px",marginTop:"4px",marginRight:"4px"}, onclick: async () => {
      try {
        await fetchJSON(`/lab/api/comments/${c.id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({body: ta.value.trim()})});
        await refreshComments(it, listEl);
      } catch (e) { toast(e.message, "err"); }
    }}, "Salva");
    const cancel = el("button", {class:"btn ghost", style:{padding:"4px 10px",fontSize:"11px",marginTop:"4px"}, onclick: () => refreshComments(it, listEl)}, "Annulla");
    body.innerHTML = "";
    body.appendChild(ta);
    body.appendChild(save);
    body.appendChild(cancel);
  }
  async function deleteComment(c, it, listEl) {
    if (!confirm("Eliminare questo commento?")) return;
    try {
      await fetchJSON(`/lab/api/comments/${c.id}`, {method:"DELETE"});
      await refreshComments(it, listEl);
    } catch (e) { toast(e.message, "err"); }
  }

  // ============================== reviews (giudizi operatore) ==============================
  function reviewKey(it) {
    // Per i salvati su DB usiamo "case:<id>", per i predef "predef:<type>:<id>"
    if (it.kind === "saved") return `case:${it.id}`;
    return `predef:${it.type}:${it.id}`;
  }
  async function loadReviewsFromAPI() {
    try {
      const rows = await fetchJSON("/lab/api/reviews");
      STATE.reviews = {};
      rows.forEach(r => { STATE.reviews[r.target_key] = { judgement: r.judgement, reviewedAt: r.updated_at }; });
    } catch { STATE.reviews = {}; }
    STATE.hideReviewed = localStorage.getItem(LS_HIDE_REVIEWED) === "1";
  }
  function getReview(it) { return it ? STATE.reviews[reviewKey(it)] : null; }
  async function setReview(it, judgement) {
    if (!it) return;
    const k = reviewKey(it);
    try {
      await fetchJSON(`/lab/api/reviews/${encodeURIComponent(k)}`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ judgement })
      });
      if (judgement == null) delete STATE.reviews[k];
      else STATE.reviews[k] = { judgement, reviewedAt: new Date().toISOString() };
    } catch (e) { toast("Errore salvataggio giudizio: " + e.message, "err"); }
  }
  const REVIEW_META = {
    ok:     { lbl:"Corretto",      icon:"thumb_up",    color:"#16a34a", bg:"#DCFCE7", border:"#86EFAC" },
    ko:     { lbl:"Sbagliato",     icon:"thumb_down",  color:"#dc2626", bg:"#FEE2E2", border:"#FCA5A5" },
    unsure: { lbl:"Da verificare", icon:"help",        color:"#a16207", bg:"#FEF3C7", border:"#FCD34D" }
  };

  function loadSnapshotsFromLS() {
    try { STATE.snapshots = JSON.parse(localStorage.getItem(LS_SNAP) || "{}") || {}; }
    catch { STATE.snapshots = {}; }
  }

  async function showSaveDialog() {
    if (!STATE.record || !STATE.selected) { toast("Seleziona un'anagrafica", "err"); return; }
    const existing = STATE.selected.kind === "saved" ? STATE.saved.find(s => s.id === STATE.selected.id) : null;
    const defaultName = existing?.name || `Caso ${STATE.selected.id}`;
    const name = prompt("Nome del caso (descrivi la casistica):", defaultName);
    if (!name) return;
    const shared = false;  // single-user: i casi sono sempre privati
    try {
      if (existing) {
        const updated = await fetchJSON(`/lab/api/cases/${existing.id}`, {
          method:"PUT", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name, type: STATE.selected.type, record: STATE.record, shared })
        });
        await loadSavedFromAPI();
        STATE.items = buildItems(); updateFolderCounts(); renderListPane();
        toast(`"${name}" aggiornato`, "ok");
      } else {
        const created = await fetchJSON("/lab/api/cases", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name, type: STATE.selected.type, record: STATE.record, shared })
        });
        await loadSavedFromAPI();
        STATE.selected = { kind:"saved", type:created.type, id:created.id };
        STATE.folder = "saved"; updateFolderActive();
        STATE.items = buildItems(); updateFolderCounts(); renderListPane();
        toast(`Caso "${name}" salvato`, "ok");
      }
    } catch (e) { toast("Errore: " + e.message, "err"); }
  }

  async function deleteCurrentSaved() {
    if (!STATE.selected || STATE.selected.kind !== "saved") return;
    const it = STATE.saved.find(s => s.id === STATE.selected.id);
    if (!it) return;
    if (!confirm(`Eliminare "${it.name}"?`)) return;
    try {
      await fetchJSON(`/lab/api/cases/${it.id}`, {method:"DELETE"});
      await loadSavedFromAPI();
      STATE.selected = null;
      document.documentElement.classList.remove("has-selection");
      STATE.items = buildItems(); updateFolderCounts(); renderListPane();
      $("#ml-detail").innerHTML = emptyDetailHTML();
      toast("Caso eliminato", "ok");
    } catch (e) { toast("Errore: " + e.message, "err"); }
  }

  // ============================== events + init ==============================
  function updateFolderActive() {
    $$('.ml-folders li').forEach(li => li.classList.toggle("active", li.dataset.folder === STATE.folder));
  }

  function bindAll() {
    // folders
    $$('.ml-folders li').forEach(li => {
      if (li.classList.contains("sep")) return;
      li.addEventListener("click", () => {
        STATE.folder = li.dataset.folder;
        updateFolderActive();
        renderListPane();
      });
    });
    // search
    $("#ana-search").addEventListener("input", debounce(e => { STATE.query = e.target.value.trim(); renderListPane(); }, 120));
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
    // sidebar actions
    $("#ana-new").addEventListener("click", () => openWizard());
    // server URL chip (optional in header)
    const serverChip = $("#server-url"); if (serverChip) serverChip.textContent = location.origin;
    // sidebar collapse toggle (persisted; initial class is applied by the
    // inline <head> script before first paint to avoid flicker)
    const layout = document.querySelector(".ml-layout");
    const html = document.documentElement;
    if (localStorage.getItem(LS_SIDEBAR) === "1") layout.classList.add("sidebar-collapsed");
    $("#sidebar-toggle").addEventListener("click", () => {
      const collapsed = !html.classList.contains("sidebar-collapsed");
      html.classList.toggle("sidebar-collapsed", collapsed);
      layout.classList.toggle("sidebar-collapsed", collapsed);
      localStorage.setItem(LS_SIDEBAR, collapsed ? "1" : "0");
    });

    // Mobile: hamburger → apre sidebar come drawer
    const closeMobileSidebar = () => html.classList.remove("mobile-sidebar-open");
    $("#mobile-menu")?.addEventListener("click", () => html.classList.toggle("mobile-sidebar-open"));
    $("#mobile-overlay")?.addEventListener("click", closeMobileSidebar);
    // Chiudere drawer quando si seleziona una folder sul mobile
    $$('.ml-folders li[data-folder]').forEach(li => li.addEventListener("click", closeMobileSidebar));
    $("#ana-new")?.addEventListener("click", closeMobileSidebar);
  }

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

  async function init() {
    // Check auth (redirect a login.html se non autenticato)
    try {
      STATE.me = await fetchJSON("/lab/api/me");
    } catch (e) {
      if (String(e.message).startsWith("401")) { location.href = "/lab/login.html"; return; }
      toast("Errore auth: " + e.message, "err"); return;
    }
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

    bindAll();
    buildTutorialOverlay();
    if (!localStorage.getItem(LS_TUTORIAL)) showTutorial();
    await loadSavedFromAPI();
    loadSnapshotsFromLS();
    await loadReviewsFromAPI();
    updateFolderActive();
    try {
      const [clients, leads, cfg] = await Promise.all([
        fetchJSON("/nba/clients?n=10000"),
        fetchJSON("/nba/leads?n=10000"),
        fetchJSON("/config")
      ]);
      STATE.clients = clients || []; STATE.leads = leads || []; STATE.config = cfg;
      await Promise.all([
        ...STATE.clients.map(c => fetchJSON(`/nba/client/?client_id=${c.client_id}`).then(d => STATE.detailCache[`client:${c.client_id}`] = d).catch(()=>null)),
        ...STATE.leads.map(l => fetchJSON(`/nba/lead/?lead_id=${l.lead_id}`).then(d => STATE.detailCache[`lead:${l.lead_id}`] = d).catch(()=>null))
      ]);
      STATE.items = buildItems();
      updateFolderCounts();
      renderListPane();

      // deep link
      const params = new URLSearchParams(location.search);
      const t = params.get("type"); const id = params.get("id");
      if (t && id && (t === "client" || t === "lead")) {
        const list = t === "client" ? STATE.clients : STATE.leads;
        const rec = list.find(r => (t === "client" ? r.client_id : r.lead_id) === id);
        if (rec) {
          const it = STATE.items.find(x => x.kind === "predef" && x.type === t && x.id === id);
          if (it) loadAnagrafica(it);
        }
      }
    } catch (e) {
      toast("Errore avvio: " + e.message, "err");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
