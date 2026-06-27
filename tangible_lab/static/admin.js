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
    const verEl = $("#brand-ver"); if (verEl && STATE.me.version) verEl.textContent = "v" + STATE.me.version;
    $$('.admin-tabs button').forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") closeModal(); });
    switchTab("export");
  }

  function switchTab(t) {
    $$('.admin-tabs button').forEach(b => b.classList.toggle("active", b.dataset.tab === t));
    $("#tab-export").classList.remove("hide");
    renderExport();
  }

  function renderExport() {
    const box = $("#tab-export"); box.innerHTML = "";
    const onboarding = new URLSearchParams(location.search).get("onboarding") === "1";

    // --- Importa dataset (blocco principale, in cima) ---
    const dsCard = el("div", {class:"section-block" + (onboarding ? " onboarding-focus" : "")});
    dsCard.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "database"),
      el("h3", {}, "Importa dataset")
    ));
    const dsFile = el("input", {type:"file", accept:".json"});
    const dsBtn = el("button", {class:"btn primary-cta", style:{display:"inline-flex",alignItems:"center",gap:"6px",padding:"10px 18px"}, onclick: async () => {
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
        if (onboarding) setTimeout(() => { location.href = "/lab/"; }, 1000);
      } catch (e) { toast(e.message, "err"); }
    }}, el("span", {class:"msi"}, "upload"), " Importa dataset");
    dsCard.appendChild(el("div", {class:"section-body", style:{display:"flex", flexDirection:"column", gap:"12px"}},
      el("p", {class:"muted", style:{margin:"0",fontSize:"13px",lineHeight:"1.55"}},
        "Carica il file dataset.json reale (clienti e lead Vittoria). I dati restano solo su questo computer e non vengono mai caricati online. L'import sostituisce il dataset corrente."),
      el("div", {style:{display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap"}}, dsFile, dsBtn)));
    box.appendChild(dsCard);

    // --- Esporta stato dei test ---
    const card = el("div", {class:"section-block"});
    card.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "file_download"),
      el("h3", {}, "Esporta stato dei test")
    ));
    const body = el("div", {class:"section-body", style:{display:"flex",flexDirection:"column",gap:"14px"}});

    body.appendChild(el("p", {class:"muted", style:{margin:"0",fontSize:"13px",lineHeight:"1.5"}},
      "Genera un file Excel multi-foglio con lo stato corrente dei test. Il file contiene 4 fogli:"));
    body.appendChild(el("ul", {style:{margin:"0",paddingLeft:"22px",fontSize:"13px",color:"var(--ink2)",lineHeight:"1.6"}},
      el("li", {}, el("strong", {}, "Riepilogo"), " — KPI aggregati (utenti, giudizi per tipo, casi, commenti) + tabella attività per utente"),
      el("li", {}, el("strong", {}, "Stato per anagrafica"), " — una riga per ogni anagrafica analizzata, con NBA (tier/score/strategia/azione principale), giudizi ricevuti, n. note, data ultimo giudizio"),
      el("li", {}, el("strong", {}, "Giudizi"), " — lista cronologica di tutti i giudizi espressi: utente, target, giudizio, date"),
      el("li", {}, el("strong", {}, "Note"), " — testo di tutte le note/commenti: utente, target, nota, date")
    ));

    // Messaggi rivisti sempre attivi: l'export usa sempre i testi rivisti.
    const exportUrl = `/lab/admin/export/state.xlsx?revised=1`;
    body.appendChild(el("div", {style:{display:"flex",gap:"10px",marginTop:"6px",flexWrap:"wrap"}},
      el("a", {
        class:"btn primary-cta",
        href: exportUrl,
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

    // --- Reseed scenari Check-up ---
    const tools = el("div", {class:"section-block"});
    tools.appendChild(el("div", {class:"section-head"},
      el("span", {class:"msi section-ico"}, "health_and_safety"),
      el("h3", {}, "Scenari Check-up")
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
        "Popola il Check-up con 10 scenari demo. Idempotente: salta quelli già presenti."),
      seedBtn
    ));
    box.appendChild(tools);

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
  }

  function closeModal() { $("#modal-bg").classList.remove("open"); }

  document.addEventListener("DOMContentLoaded", init);
})();
