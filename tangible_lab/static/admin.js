/* Tangible Lab — pannello admin */
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
    const app = c => { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(app); return; } if (typeof c === "string" || typeof c === "number") { e.appendChild(document.createTextNode(String(c))); return; } e.appendChild(c); };
    children.forEach(app);
    return e;
  };
  const toast = (m, k="") => { const t = $("#toast"); t.textContent = m; t.className = "toast show " + k; setTimeout(()=>{t.className = "toast " + k;}, 2400); };
  const fetchJSON = async (url, opts={}) => {
    const r = await fetch(url, {credentials:"include", ...opts});
    if (r.status === 401) { location.href = "/lab/login.html"; throw new Error("Not authenticated"); }
    if (r.status === 403) { location.href = "/lab/"; throw new Error("Not authorized"); }
    if (!r.ok) { let e=""; try{e=(await r.json()).detail||r.statusText;}catch{e=r.statusText;} throw new Error(`${r.status}: ${e}`); }
    return r.json();
  };

  let STATE = { me:null, stats:null };

  async function init() {
    try { STATE.me = await fetchJSON("/lab/api/me"); }
    catch { return; }
    if (STATE.me.role !== "admin") { location.href = "/lab/"; return; }
    $("#me-name").textContent = STATE.me.username + " · admin";
    $("#logout-btn").addEventListener("click", async () => {
      await fetch("/lab/api/logout", {method:"POST", credentials:"include"});
      location.href = "/lab/login.html";
    });
    $$('.admin-tabs button').forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") closeModal(); });
    switchTab("dashboard");
  }

  function switchTab(t) {
    $$('.admin-tabs button').forEach(b => b.classList.toggle("active", b.dataset.tab === t));
    ["dashboard","users","cases","reviews","export"].forEach(x => $("#tab-"+x).classList.toggle("hide", x !== t));
    if (t === "dashboard") renderDashboard();
    if (t === "users") renderUsers();
    if (t === "cases") renderCases();
    if (t === "reviews") renderReviews();
    if (t === "export") renderExport();
  }

  function renderExport() {
    const box = $("#tab-export"); box.innerHTML = "";
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "file_download"),
      el("h3", {}, "Esporta stato dei test")
    ));
    const body = el("div", {class:"section-body", style:{display:"flex",flexDirection:"column",gap:"14px"}});

    body.appendChild(el("p", {class:"muted", style:{margin:"0",fontSize:"13px",lineHeight:"1.5"}},
      "Genera un file Excel multi-foglio con lo stato corrente dei test. Il file contiene 3 fogli:"));
    body.appendChild(el("ul", {style:{margin:"0",paddingLeft:"22px",fontSize:"13px",color:"var(--ink2)",lineHeight:"1.6"}},
      el("li", {}, el("strong", {}, "Riepilogo"), " — KPI aggregati (utenti, giudizi per tipo, casi, commenti) + tabella attività per utente"),
      el("li", {}, el("strong", {}, "Stato per anagrafica"), " — una riga per ogni anagrafica analizzata, con NBA (tier/score/strategia/azione principale), giudizi ricevuti, commenti, data ultimo giudizio"),
      el("li", {}, el("strong", {}, "Giudizi"), " — lista cronologica di tutti i giudizi espressi: utente, target, giudizio, date")
    ));

    body.appendChild(el("div", {style:{display:"flex",gap:"10px",marginTop:"6px",flexWrap:"wrap"}},
      el("a", {
        class:"btn primary-cta",
        href:"/lab/admin/export/state.xlsx",
        download:"stato-test.xlsx",
        style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"6px",padding:"10px 18px"}
      }, el("span", {class:"msi"}, "download"), " Scarica Excel"),
      el("a", {
        class:"btn ghost",
        href:"/lab/admin/reviews?format=csv",
        download:"giudizi.csv",
        style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"6px",padding:"10px 18px"}
      }, el("span", {class:"msi"}, "table_chart"), " CSV solo giudizi")
    ));

    card.appendChild(body);
    box.appendChild(card);
  }

  // ============ DASHBOARD ============
  async function renderDashboard() {
    const box = $("#tab-dashboard"); box.innerHTML = '<div class="muted">Caricamento…</div>';
    let s; try { s = await fetchJSON("/lab/admin/stats"); STATE.stats = s; }
    catch (e) { box.innerHTML = `<div class="ml-not-run">Errore: ${e.message}</div>`; return; }
    box.innerHTML = "";

    // Tools row (seed checkup)
    const tools = el("div", {class:"section-block"});
    tools.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "build"),
      el("h3", {}, "Strumenti")
    ));
    const seedBtn = el("button", {class:"btn", onclick: async () => {
      seedBtn.disabled = true;
      try {
        const r = await fetchJSON("/lab/admin/checkup/reseed", {method:"POST"});
        toast(`Scenari Check-up: ${r.created} creati, ${r.skipped} già presenti`, "ok");
      } catch (e) { toast(e.message, "err"); }
      finally { seedBtn.disabled = false; }
    }}, el("span", {class:"msi"}, "health_and_safety"), " Carica scenari demo Check-up");
    tools.appendChild(el("div", {class:"section-body"},
      el("div", {class:"muted", style:{fontSize:"12px",marginBottom:"10px"}},
        "Popola il Check-up con 10 scenari condivisi (famiglie, professionisti, pensionati, ecc.). Idempotente: salta gli scenari il cui nome esiste già."),
      seedBtn
    ));
    box.appendChild(tools);

    box.appendChild(el("div", {class:"kpi-grid"},
      kpiTile("group", "Utenti totali", String(s.users.total), `${s.users.active} attivi`),
      kpiTile("folder_shared", "Casi di test", String(s.cases.total), `${s.cases.shared} condivisi`),
      kpiTile("rate_review", "Giudizi totali", String(s.reviews.total),
        Object.entries(s.reviews.by_judgement||{}).map(([k,v]) => `${k}: ${v}`).join(" · ")),
      kpiTile("chat", "Commenti", String(s.comments.total), "thread totali")
    ));
    // Per utente
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "leaderboard"),
      el("h3", {}, "Attività per utente")
    ));
    const tbl = el("table", {class:"adm"});
    tbl.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "Utente"), el("th", {}, "Ruolo"), el("th", {}, "Stato"),
      el("th", {}, "Giudizi"), el("th", {}, "Casi"), el("th", {}, "Commenti")
    )));
    const tb = el("tbody");
    s.per_user.forEach(u => {
      tb.appendChild(el("tr", {},
        el("td", {}, el("strong", {}, u.username)),
        el("td", {}, el("span", {class:"role-pill "+u.role}, u.role)),
        el("td", {}, el("span", {class:"status-pill " + (u.active?"on":"off")}, u.active?"attivo":"disattivo")),
        el("td", {}, String(u.reviews)),
        el("td", {}, String(u.cases)),
        el("td", {}, String(u.comments))
      ));
    });
    tbl.appendChild(tb);
    card.appendChild(el("div", {class:"section-body"}, tbl));
    box.appendChild(card);
  }
  function kpiTile(icon, label, value, sub) {
    return el("div", {class:"stat-tile"},
      el("span", {class:"msi stat-ico"}, icon),
      el("div", {class:"stat-text"},
        el("div", {class:"stat-k"}, label),
        el("div", {class:"stat-v"}, value),
        sub ? el("div", {class:"muted", style:{fontSize:"10px",marginTop:"2px"}}, sub) : null
      )
    );
  }

  // ============ USERS ============
  async function renderUsers() {
    const box = $("#tab-users"); box.innerHTML = '<div class="muted">Caricamento…</div>';
    let users; try { users = await fetchJSON("/lab/admin/users"); }
    catch (e) { box.innerHTML = `<div class="ml-not-run">Errore: ${e.message}</div>`; return; }
    box.innerHTML = "";
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "group"),
      el("h3", {}, "Utenti"),
      el("button", {class:"btn", style:{marginLeft:"auto"}, onclick: openCreateUserModal},
        el("span", {class:"msi"}, "person_add"), " Nuovo utente")
    ));
    const tbl = el("table", {class:"adm"});
    tbl.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "ID"), el("th", {}, "Username"), el("th", {}, "Ruolo"), el("th", {}, "Stato"),
      el("th", {}, "Creato"), el("th", {}, "Ultimo accesso"), el("th", {}, "Azioni")
    )));
    const tb = el("tbody");
    users.forEach(u => {
      tb.appendChild(el("tr", {},
        el("td", {}, String(u.id)),
        el("td", {}, el("strong", {}, u.username), u.must_change_password ? el("div", {class:"muted", style:{fontSize:"10px"}}, "Deve cambiare password") : null),
        el("td", {}, el("span", {class:"role-pill "+u.role}, u.role)),
        el("td", {}, el("span", {class:"status-pill " + (u.active?"on":"off")}, u.active?"attivo":"disattivo")),
        el("td", {class:"muted", style:{fontSize:"11px"}}, u.created_at || "—"),
        el("td", {class:"muted", style:{fontSize:"11px"}}, u.last_login_at || "mai"),
        el("td", {},
          el("button", {class:"btn ghost", style:{padding:"4px 8px",fontSize:"11px"}, onclick: () => openEditUserModal(u)}, "Modifica"),
          " ",
          el("button", {class:"btn ghost", style:{padding:"4px 8px",fontSize:"11px"}, onclick: () => resetPasswordPrompt(u)}, "Reset pw"),
          " ",
          el("button", {class:"btn ghost", style:{padding:"4px 8px",fontSize:"11px"}, onclick: () => toggleActive(u)}, u.active ? "Disattiva" : "Attiva"),
          " ",
          u.id !== STATE.me.id ? el("button", {class:"btn danger", style:{padding:"4px 8px",fontSize:"11px"}, onclick: () => deleteUserPrompt(u)}, "Elimina") : null
        )
      ));
    });
    tbl.appendChild(tb);
    card.appendChild(el("div", {class:"section-body"}, tbl));
    box.appendChild(card);
  }
  function openCreateUserModal() {
    showModal({
      title:"Nuovo utente",
      fields:[
        {k:"username", lbl:"Username", type:"text", required:true},
        {k:"password", lbl:"Password iniziale", type:"text", required:true, hint:"L'utente dovrà cambiarla al primo accesso"},
        {k:"role", lbl:"Ruolo", type:"select", opts:[["tester","Tester"],["admin","Admin"]], def:"tester"}
      ],
      submit: async (v) => {
        try {
          await fetchJSON("/lab/admin/users", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(v)});
          closeModal(); renderUsers(); toast("Utente creato", "ok");
        } catch (e) { toast(e.message, "err"); }
      }
    });
  }
  function openEditUserModal(u) {
    showModal({
      title: `Modifica ${u.username}`,
      fields:[
        {k:"role", lbl:"Ruolo", type:"select", opts:[["tester","Tester"],["admin","Admin"]], def: u.role}
      ],
      submit: async (v) => {
        try { await fetchJSON(`/lab/admin/users/${u.id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(v)});
          closeModal(); renderUsers(); toast("Aggiornato", "ok");
        } catch (e) { toast(e.message, "err"); }
      }
    });
  }
  async function resetPasswordPrompt(u) {
    const pw = prompt(`Nuova password per ${u.username}:`);
    if (!pw) return;
    if (pw.length < 6) { toast("Almeno 6 caratteri", "err"); return; }
    try { await fetchJSON(`/lab/admin/users/${u.id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({password: pw})});
      toast("Password reimpostata", "ok"); renderUsers();
    } catch (e) { toast(e.message, "err"); }
  }
  async function toggleActive(u) {
    try { await fetchJSON(`/lab/admin/users/${u.id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({active: !u.active})});
      renderUsers(); toast(u.active ? "Disattivato" : "Attivato", "ok");
    } catch (e) { toast(e.message, "err"); }
  }
  async function deleteUserPrompt(u) {
    if (!confirm(`Eliminare definitivamente "${u.username}"? Tutti i suoi casi e giudizi verranno persi.`)) return;
    try { await fetchJSON(`/lab/admin/users/${u.id}`, {method:"DELETE"});
      renderUsers(); toast("Eliminato", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  // ============ CASES ============
  async function renderCases() {
    const box = $("#tab-cases"); box.innerHTML = '<div class="muted">Caricamento…</div>';
    let cases; try { cases = await fetchJSON("/lab/admin/cases"); }
    catch (e) { box.innerHTML = `<div class="ml-not-run">Errore: ${e.message}</div>`; return; }
    box.innerHTML = "";
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "folder_shared"),
      el("h3", {}, "Casi di test (tutti gli utenti)"),
      el("span", {class:"section-hint"}, `${cases.length} casi · ${cases.filter(c=>c.shared).length} condivisi`)
    ));
    const tbl = el("table", {class:"adm"});
    tbl.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "ID"), el("th", {}, "Nome"), el("th", {}, "Tipo"), el("th", {}, "Autore"),
      el("th", {}, "Condiviso"), el("th", {}, "Aggiornato"), el("th", {}, "Azioni")
    )));
    const tb = el("tbody");
    cases.forEach(c => {
      tb.appendChild(el("tr", {},
        el("td", {}, String(c.id)),
        el("td", {}, el("strong", {}, c.name)),
        el("td", {}, el("span", {class:"chip"}, c.type === "client" ? "Cliente" : "Lead")),
        el("td", {}, c.owner_username),
        el("td", {}, c.shared ? el("span", {class:"status-pill on"}, "sì") : el("span", {class:"status-pill off"}, "no")),
        el("td", {class:"muted", style:{fontSize:"11px"}}, c.updated_at),
        el("td", {}, el("button", {class:"btn danger", style:{padding:"4px 8px",fontSize:"11px"}, onclick: () => deleteCasePrompt(c)}, "Elimina"))
      ));
    });
    tbl.appendChild(tb);
    card.appendChild(el("div", {class:"section-body"}, tbl));
    box.appendChild(card);
  }
  async function deleteCasePrompt(c) {
    if (!confirm(`Eliminare il caso "${c.name}" di ${c.owner_username}?`)) return;
    try { await fetchJSON(`/lab/api/cases/${c.id}`, {method:"DELETE"});
      renderCases(); toast("Eliminato", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  // ============ REVIEWS ============
  async function renderReviews() {
    const box = $("#tab-reviews"); box.innerHTML = '<div class="muted">Caricamento…</div>';
    let revs; try { revs = await fetchJSON("/lab/admin/reviews"); }
    catch (e) { box.innerHTML = `<div class="ml-not-run">Errore: ${e.message}</div>`; return; }
    box.innerHTML = "";
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "rate_review"),
      el("h3", {}, "Giudizi"),
      el("a", {class:"btn ghost", href:"/lab/admin/reviews?format=csv", style:{marginLeft:"auto",padding:"4px 10px",fontSize:"12px",textDecoration:"none"}},
        el("span", {class:"msi"}, "download"), " Esporta CSV")
    ));
    const tbl = el("table", {class:"adm"});
    tbl.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "ID"), el("th", {}, "Target"), el("th", {}, "Utente"), el("th", {}, "Giudizio"),
      el("th", {}, "Aggiornato")
    )));
    const tb = el("tbody");
    const meta = { ok:"Corretto", ko:"Sbagliato", unsure:"Da verificare" };
    revs.forEach(r => {
      tb.appendChild(el("tr", {},
        el("td", {}, String(r.id)),
        el("td", {}, el("code", {style:{fontSize:"11px"}}, r.target_key)),
        el("td", {}, r.username),
        el("td", {}, el("span", {class:"review-badge "+r.judgement, style:{display:"inline-flex",padding:"3px 9px",borderRadius:"6px",fontSize:"11px",fontWeight:"700",width:"auto",height:"auto"}}, meta[r.judgement] || r.judgement)),
        el("td", {class:"muted", style:{fontSize:"11px"}}, r.updated_at)
      ));
    });
    tbl.appendChild(tb);
    card.appendChild(el("div", {class:"section-body"}, tbl));
    box.appendChild(card);

    // --- Importa dataset (sostituisce quello corrente) ---
    const dsCard = el("div", {class:"section-block"});
    dsCard.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "database"),
      el("span", {}, "Importa dataset")));
    const dsFile = el("input", {type:"file", accept:".json"});
    const dsBtn = el("button", {class:"btn", onclick: async () => {
      const f = dsFile.files && dsFile.files[0];
      if (!f) { toast("Seleziona un file dataset.json", "err"); return; }
      if (!confirm("L'import SOSTITUISCE il dataset corrente. Procedere?")) return;
      let obj;
      try { obj = JSON.parse(await f.text()); }
      catch { toast("File JSON non valido", "err"); return; }
      try {
        const r = await fetchJSON("/lab/admin/dataset/import", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(obj),
        });
        toast(`Importati ${r.clients} clienti e ${r.leads} lead`, "ok");
      } catch (e) { toast(e.message, "err"); }
    }}, "Importa");
    dsCard.appendChild(el("div", {class:"section-body", style:{display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap"}},
      el("span", {class:"muted"}, "Carica il dataset.json reale (resta solo su questo PC)."),
      dsFile, dsBtn));
    box.appendChild(dsCard);
  }

  // ============ MODAL ============
  function showModal({title, fields, submit}) {
    const m = $("#modal");
    m.innerHTML = "";
    m.appendChild(el("h3", {}, title));
    const inputs = {};
    fields.forEach(f => {
      const lab = el("label", {}, f.lbl);
      let input;
      if (f.type === "select") {
        input = el("select", {});
        f.opts.forEach(([v,t]) => input.appendChild(el("option", {value:v}, t)));
        if (f.def) input.value = f.def;
      } else {
        input = el("input", {type:f.type, required: f.required ? true : null});
      }
      inputs[f.k] = input;
      lab.appendChild(input);
      if (f.hint) lab.appendChild(el("div", {class:"muted", style:{fontSize:"10px",marginTop:"2px"}}, f.hint));
      m.appendChild(lab);
    });
    m.appendChild(el("div", {class:"actions"},
      el("button", {class:"btn ghost", onclick: closeModal}, "Annulla"),
      el("button", {class:"btn primary-cta", onclick: () => {
        const v = {};
        Object.entries(inputs).forEach(([k,inp]) => { v[k] = inp.value; });
        submit(v);
      }}, "Conferma")
    ));
    $("#modal-bg").classList.add("open");
  }
  function closeModal() { $("#modal-bg").classList.remove("open"); }

  document.addEventListener("DOMContentLoaded", init);
})();
