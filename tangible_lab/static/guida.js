/* Tangible Lab — Guida "Come funziona".
   Auth gate + valori live da /config + 3 widget (pesi, slider tier, esempio demo). */
(() => {
  "use strict";

  const $ = s => document.querySelector(s);

  const fetchJSON = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: "include", ...opts });
    if (r.status === 401) { location.href = "/lab/login.html"; throw new Error("Not authenticated"); }
    if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
    return r.json();
  };

  // ---------- formati valori live ----------
  const FMT = {
    "pct":             v => Math.round(v * 100) + "%",
    "eur":             v => "€ " + Number(v).toLocaleString("it-IT"),
    "days-from-hours": v => String(Math.round(v / 24)),
  };

  const cfgValue = (cfg, path) => {
    let node = cfg;
    for (const part of path.split(".")) {
      node = node?.[part];
      if (node == null) return null;
    }
    return (typeof node === "object" && "value" in node) ? node.value : node;
  };

  function injectLiveValues(cfg) {
    document.querySelectorAll("[data-cfg]").forEach(el => {
      const v = cfgValue(cfg, el.dataset.cfg);
      if (v == null) return;
      const fmt = FMT[el.dataset.fmt];
      el.textContent = fmt ? fmt(v) : String(v);
    });
  }

  function configUnavailable() {
    const b = $("#live-banner");
    b.classList.add("warn");
    b.innerHTML = '<span class="msi">warning</span><div>Valori di configurazione ' +
      'non disponibili al momento: i numeri evidenziati non possono essere mostrati, ' +
      'ma le logiche descritte restano valide.</div>';
  }

  // ---------- widget 1: pesi ----------
  const DIM_LABELS = {
    urgency: "Urgenza", value: "Valore economico",
    opportunity: "Opportunità commerciale", recency: "Recency contatto",
    timing: "Timing",
  };

  function renderWeights(containerSel, weightsSchema) {
    const box = $(containerSel);
    const entries = Object.entries(weightsSchema).map(([k, node]) => [k, Number(node.value)]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!(total > 0)) { box.innerHTML = '<div class="w-error">Pesi non disponibili.</div>'; return; }
    box.innerHTML = "";
    entries
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => {
        const pct = Math.round((v / total) * 100);
        const row = document.createElement("div");
        row.className = "wrow";
        row.innerHTML =
          `<span class="wlbl">${DIM_LABELS[k] || k}</span>` +
          `<span class="wbar"><span class="wfill" style="width:${pct}%"></span></span>` +
          `<span class="wpct">${pct}%</span>`;
        box.appendChild(row);
      });
  }

  function renderLeadPhrase(leadWeights) {
    const entries = Object.entries(leadWeights).map(([k, n]) => [k, Number(n.value)]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!(total > 0)) return;
    const [topKey, topVal] = entries.sort((a, b) => b[1] - a[1])[0];
    $("#lead-weights-phrase").textContent =
      `Con la configurazione attuale la dimensione che pesa di più è ` +
      `${(DIM_LABELS[topKey] || topKey).toLowerCase()} (~${Math.round((topVal / total) * 100)}%).`;
  }

  // ---------- widget 2: slider tier ----------
  const TIER_META = {
    CRITICAL: { color: "#E80E3F", desc: "Azione immediata — contattare nella giornata" },
    HIGH:     { color: "#F59E0B", desc: "Alta priorità — contattare entro 24–48 ore" },
    MEDIUM:   { color: "#00B5A3", desc: "Priorità media — pianificare nella settimana" },
    LOW:      { color: "#6b7280", desc: "Bassa urgenza — gestione ordinaria" },
  };

  function tierFor(score, t) {
    if (score >= t.CRITICAL) return "CRITICAL";
    if (score >= t.HIGH) return "HIGH";
    if (score >= t.MEDIUM) return "MEDIUM";
    return "LOW";
  }

  function setupTierSlider(cfg) {
    const t = {
      CRITICAL: Number(cfgValue(cfg, "tiers.CRITICAL")),
      HIGH: Number(cfgValue(cfg, "tiers.HIGH")),
      MEDIUM: Number(cfgValue(cfg, "tiers.MEDIUM")),
    };
    const track = $("#tier-track");
    track.style.background = `linear-gradient(90deg,
      ${TIER_META.LOW.color} 0% ${t.MEDIUM}%,
      ${TIER_META.MEDIUM.color} ${t.MEDIUM}% ${t.HIGH}%,
      ${TIER_META.HIGH.color} ${t.HIGH}% ${t.CRITICAL}%,
      ${TIER_META.CRITICAL.color} ${t.CRITICAL}% 100%)`;
    track.innerHTML = "";
    [["MEDIUM", t.MEDIUM], ["HIGH", t.HIGH], ["CRITICAL", t.CRITICAL]].forEach(([, thr]) => {
      const m = document.createElement("span");
      m.className = "tier-mark";
      m.style.left = thr + "%";
      m.textContent = thr;
      track.appendChild(m);
    });

    const slider = $("#tier-slider");
    const update = () => {
      const score = Number(slider.value);
      const tier = tierFor(score, t);
      $("#tier-score").textContent = score;
      const chip = $("#tier-chip");
      chip.textContent = tier;
      chip.style.background = TIER_META[tier].color;
      $("#tier-desc").textContent = TIER_META[tier].desc;
    };
    slider.addEventListener("input", update);
    update();
  }

  // ---------- widget 3: esempio demo ----------
  // Date relative a oggi: l'esempio resta stabile nel tempo.
  function demoClient() {
    const iso = days => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    return {
      client_id: "C-DEMO",
      email: "maria.rossi@example.it",
      phone: "+39 333 0000000",
      preferred_channel: "PHONE",
      whatsapp_enabled: true,
      last_contact_days: 95,
      customer_tenure_years: 8,
      active_policies_count: 2,
      checkup_done: true,
      viva_enrolled: true,
      cross_sell_gaps: ["HOME"],
      policies: [
        { policy_number: "P-001", product: "AUTO", premium: 1100, expiry_date: iso(10), churn_rate: 0.05 },
        { policy_number: "P-002", product: "VITA", premium: 600, expiry_date: iso(200), churn_rate: 0.05 },
      ],
    };
  }

  const DEMO_FACTS = [
    ["badge", "Maria Rossi — cliente da 8 anni"],
    ["shield", "2 polizze: AUTO (€1.100) in scadenza tra 10 giorni, VITA (€600)"],
    ["report", "Gap di copertura: casa (HOME)"],
    ["schedule", "Ultimo contatto: 95 giorni fa"],
    ["call", "Canale preferito: telefono"],
  ];

  function fmt1(n) { return Number(n).toLocaleString("it-IT", { maximumFractionDigits: 1 }); }

  async function renderDemo(cfg) {
    const box = $("#w-demo");
    let bd, nba = null;
    try {
      bd = await fetchJSON("/lab/breakdown/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: demoClient() }),
      });
    } catch {
      box.innerHTML = '<div class="w-error">Esempio non disponibile al momento (il motore non risponde).</div>';
      return;
    }
    try {
      const r = await fetch("/nba/client/test", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoClient()),
      });
      if (r.ok && r.status !== 204) nba = await r.json();
    } catch { /* l'azione è un di più: il breakdown basta */ }

    const tiers = {
      CRITICAL: Number(cfgValue(cfg, "tiers.CRITICAL")),
      HIGH: Number(cfgValue(cfg, "tiers.HIGH")),
      MEDIUM: Number(cfgValue(cfg, "tiers.MEDIUM")),
    };
    const tier = nba?.priority_tier || tierFor(bd.final_score, tiers);
    const meta = TIER_META[tier] || TIER_META.LOW;

    const facts = DEMO_FACTS.map(([ico, txt]) =>
      `<span class="demo-fact"><span class="msi">${ico}</span>${txt}</span>`).join("");

    const rows = (bd.contributions || []).map(c =>
      `<tr><td>${DIM_LABELS[c.factor] || c.factor}</td>` +
      `<td>${fmt1(c.score)} / 100</td>` +
      `<td>× ${fmt1(c.weight)}</td>` +
      `<td style="text-align:right"><strong>${fmt1(c.contribution)}</strong></td></tr>`).join("");

    const bonuses = (bd.bonuses || []).filter(b => Number(b.value) !== 0).map(b =>
      `<tr><td colspan="3">${b.label}</td>` +
      `<td style="text-align:right"><strong>+${fmt1(b.value)}</strong></td></tr>`).join("");

    const overrideRow = bd.churn_override_applied
      ? `<tr><td colspan="4">⚠ Regola di eccezione applicata: score portato alla soglia CRITICAL (${fmt1(bd.critical_threshold)})</td></tr>`
      : "";

    const primary = nba?.recommended_actions?.find(a => a.primary);
    const actionHtml = primary
      ? `<div class="demo-action">→ Azione primaria generata: <b>«${primary.recommended_action}»</b>` +
        ` · canale: <b>${primary.recommended_channel}</b>` +
        ` · categoria: <b>${nba.strategic_category}</b></div>`
      : "";

    box.innerHTML =
      `<div class="demo-profile">${facts}</div>` +
      `<table><thead><tr><th>Dimensione</th><th>Punteggio</th><th>Peso</th><th style="text-align:right">Contributo</th></tr></thead>` +
      `<tbody>${rows}${bonuses}${overrideRow}</tbody></table>` +
      `<div class="demo-total"><span>Punteggio finale:</span>` +
      `<span class="tier-score">${fmt1(bd.final_score)}</span>` +
      `<span class="tier-chip" style="background:${meta.color}">${tier}</span></div>` +
      actionHtml;
  }

  // ---------- scrollspy sommario ----------
  function setupScrollspy() {
    const links = Array.from(document.querySelectorAll("#toc a"));
    const byId = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.remove("active"));
        byId.get(e.target.id)?.classList.add("active");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    byId.forEach((_, id) => {
      const sec = document.getElementById(id);
      if (sec) obs.observe(sec);
    });
  }

  // ---------- init ----------
  async function init() {
    let me;
    try { me = await fetchJSON("/lab/api/me"); }
    catch { return; } // 401 → redirect già fatto
    $("#user-chip").innerHTML = `<span class="msi">person</span> ${me.username}`;

    setupScrollspy();

    let cfg = null;
    try { cfg = await fetchJSON("/config"); }
    catch { configUnavailable(); }

    if (cfg) {
      injectLiveValues(cfg);
      renderWeights("#w-client-weights", cfg.client_weights || {});
      renderWeights("#w-lead-weights", cfg.lead_weights || {});
      renderLeadPhrase(cfg.lead_weights || {});
      setupTierSlider(cfg);
      renderDemo(cfg);
    } else {
      $("#w-client-weights").innerHTML = '<div class="w-error">Non disponibile.</div>';
      $("#w-lead-weights").innerHTML = '<div class="w-error">Non disponibile.</div>';
      $("#w-demo").innerHTML = '<div class="w-error">Non disponibile.</div>';
    }
  }

  init();
})();
