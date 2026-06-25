# Area "Guida — Come funziona" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pagina divulgativa `/lab/guida.html` che spiega l'algoritmo NBA con valori live da `/config` e tre widget interattivi.

**Architecture:** Tre file nuovi in `tangible_lab/static/` (`guida.html`, `guida.css`, `guida.js`) + link "Guida" negli header esistenti. Nessuna modifica al backend: si usano `/config` (GET), `/lab/breakdown/client` (POST), `/nba/client/test` (POST), `/lab/api/me` (auth gate JS). Spec: `docs/superpowers/specs/2026-06-03-guida-algoritmo-design.md`.

**Tech Stack:** Vanilla JS (pattern di `checkup.js`), CSS con i token di `studio.css`, Material Symbols. Niente build, niente dipendenze.

**Nota verifica (no TDD):** il repo non ha test infrastructure e la pagina è frontend statico; la verifica è via HTTP (curl) e Playwright sul server locale già attivo. Il server serve i file statici da disco a ogni richiesta: **non serve riavviarlo**. Porta locale corrente: usare quella stampata dal server (`[tangible_lab] NBA Studio on http://127.0.0.1:<porta>/lab/`); negli esempi si usa `$PORT`.

**Vincolo assoluto:** non toccare nessun file fuori da `tangible_lab/` (codice IT Vittoria).

**Riferimenti utili per chi esegue:**
- `/config` (GET, no auth) risponde con lo schema: `{client_weights: {urgency: {value,min,max,step}, ...}, lead_weights: {...}, tiers: {CRITICAL: {value,...}, HIGH, MEDIUM}, thresholds: {NO_CONTACT_DAYS_THRESHOLD: {value,...}, ...}}`. I valori si leggono sempre da `.value`.
- `/lab/breakdown/client` (POST, no auth) body `{client: <record>}` → `{contributions:[{factor,score,weight,contribution}], base_score, bonuses:[{label,value}], before_clamp, clamped, churn_override_applied, critical_threshold, final_score}`.
- `/nba/client/test` (POST) body = record cliente diretto → `{priority_score, priority_tier, strategic_category, triggers, recommended_actions:[{action_category, recommended_action, recommended_channel, primary, ...}]}`. Risponde **204** se il cliente non è eleggibile.
- Auth gate pattern (da `checkup.js`): `fetchJSON("/lab/api/me")`, su 401 redirect a `/lab/login.html`.
- Colori tier dell'app (da `studio.css`): CRITICAL `#E80E3F`, HIGH `#F59E0B`, MEDIUM `#00E0CA`, LOW `#9CA3AF`. La guida usa questi (coerenza con la UI), non i colori del documento Word.

---

### Task 1: Stili — `guida.css`

**Files:**
- Create: `tangible_lab/static/guida.css`

- [ ] **Step 1: Crea il file con questo contenuto**

```css
/* Tangible Lab — Guida "Come funziona" (riusa i token di studio.css) */

.guida-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:28px;max-width:1080px;margin:0 auto;padding:28px 22px 80px}

/* ---- sommario sticky ---- */
.guida-toc{position:sticky;top:84px;align-self:start;font-size:12.5px}
.guida-toc .toc-title{font-weight:700;color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.06em;margin-bottom:10px}
.guida-toc a{display:block;color:var(--ink2);text-decoration:none;padding:5px 10px;border-left:2px solid var(--border-soft);line-height:1.35}
.guida-toc a:hover{color:var(--accent)}
.guida-toc a.active{color:var(--accent);border-left-color:var(--accent);font-weight:600}
.guida-toc a.lvl2{padding-left:22px;font-size:12px}

/* ---- corpo ---- */
.guida-body{min-width:0;font-size:14px;line-height:1.65;color:var(--ink2)}
.guida-body h2{font-size:21px;color:var(--ink);margin:44px 0 10px;scroll-margin-top:84px}
.guida-body h2:first-child{margin-top:0}
.guida-body h3{font-size:15.5px;color:var(--ink);margin:30px 0 8px;scroll-margin-top:84px}
.guida-body p{margin:0 0 12px}
.guida-body table{width:100%;border-collapse:collapse;margin:14px 0 20px;font-size:13px;background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.guida-body th{text-align:left;background:var(--breeze);color:var(--ink);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;padding:9px 12px;border-bottom:1px solid var(--border)}
.guida-body td{padding:9px 12px;border-bottom:1px solid var(--border-soft);vertical-align:top}
.guida-body tr:last-child td{border-bottom:none}

/* valori live */
.live{font-weight:700;color:var(--accent);white-space:nowrap}
.live-banner{display:flex;gap:10px;align-items:flex-start;background:#E6FCF8;border:1px solid var(--highlight);border-radius:10px;padding:12px 14px;margin:16px 0;font-size:13px}
.live-banner .msi{color:#007D6F}
.live-banner.warn{background:#FFF4DC;border-color:var(--warn)}
.live-banner.warn .msi{color:#92580A}

.guida-note{background:var(--breeze);border-left:3px solid var(--cta);border-radius:0 8px 8px 0;padding:10px 14px;margin:14px 0;font-size:13px}

/* ---- widget card ---- */
.widget{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px;margin:18px 0 24px;box-shadow:0 1px 3px rgba(31,28,61,.05)}
.widget .w-title{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--ink);font-size:13.5px;margin-bottom:12px}
.widget .w-title .msi{color:var(--accent);font-size:19px}
.widget .w-hint{font-size:12px;color:var(--muted);margin-top:10px}

/* widget pesi */
.wrow{display:grid;grid-template-columns:170px minmax(0,1fr) 52px;gap:10px;align-items:center;margin:7px 0;font-size:13px}
.wrow .wlbl{color:var(--ink)}
.wrow .wbar{height:14px;background:var(--breeze);border-radius:7px;overflow:hidden}
.wrow .wfill{height:100%;background:linear-gradient(90deg,var(--cta),var(--cta2));border-radius:7px;transition:width .4s}
.wrow .wpct{text-align:right;font-weight:700;color:var(--ink)}

/* widget slider tier */
.tier-track{position:relative;height:14px;border-radius:7px;margin:26px 4px 6px;background:#ddd}
.tier-mark{position:absolute;top:-20px;transform:translateX(-50%);font-size:10.5px;font-weight:700;color:var(--muted)}
.tier-slider{width:100%;margin:10px 0 4px}
.tier-out{display:flex;align-items:center;gap:12px;margin-top:10px;font-size:13px}
.tier-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;color:#fff;font-weight:700;font-size:13px}
.tier-score{font-size:22px;font-weight:800;color:var(--ink);min-width:46px}

/* widget esempio cliente */
.demo-profile{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.demo-fact{background:var(--chip);border:1px solid var(--border-soft);border-radius:8px;padding:5px 10px;font-size:12px;display:inline-flex;gap:6px;align-items:center}
.demo-fact .msi{font-size:15px;color:var(--ink2)}
.demo-total{display:flex;align-items:center;gap:12px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}
.demo-action{margin-top:10px;background:var(--breeze);border-radius:8px;padding:10px 12px;font-size:13px}
.demo-action b{color:var(--ink)}
.w-error{color:var(--muted);font-size:13px;font-style:italic}

/* diagramma fallback canali */
.chan-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:8px 0;font-size:12.5px}
.chan-cat{min-width:170px;font-weight:700;color:var(--ink)}
.chan-step{background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:4px 12px;display:inline-flex;align-items:center;gap:5px}
.chan-step .msi{font-size:15px;color:var(--ink2)}
.chan-arr{color:var(--muted)}

/* ---- responsive ---- */
@media (max-width: 860px){
  .guida-layout{grid-template-columns:1fr;padding:18px 14px 60px}
  .guida-toc{position:static;display:flex;gap:4px;overflow-x:auto;padding-bottom:8px;border-bottom:1px solid var(--border-soft);-webkit-overflow-scrolling:touch}
  .guida-toc .toc-title{display:none}
  .guida-toc a{border-left:none;border:1px solid var(--border);border-radius:999px;padding:5px 12px;white-space:nowrap;font-size:12px}
  .guida-toc a.lvl2{display:none}
  .wrow{grid-template-columns:110px minmax(0,1fr) 46px;font-size:12px}
  .chan-cat{min-width:100%}
}
```

- [ ] **Step 2: Commit**

```bash
git add tangible_lab/static/guida.css
git commit -m "Guida: stili pagina 'Come funziona'"
```

---

### Task 2: Markup e contenuti — `guida.html`

**Files:**
- Create: `tangible_lab/static/guida.html`

Convenzioni: i numeri configurabili sono `<span class="live" data-cfg="<sezione>.<CHIAVE>">—</span>`; `data-fmt` opzionale: `pct` (0.28 → "28%"), `eur` (1900 → "€ 1.900"), `days-from-hours` (134 → "6"). `guida.js` li popola da `/config`.

- [ ] **Step 1: Crea il file con questo contenuto**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1F1C3D" />
  <title>NBA Studio — Guida al funzionamento</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
  <link rel="stylesheet" href="/lab/studio.css" />
  <link rel="stylesheet" href="/lab/guida.css" />
</head>
<body class="studio guida-page">
  <header class="studio">
    <div class="brand">
      <img class="logo-vittoria" src="/lab/assets/vittoria.svg" alt="Vittoria Assicurazioni" />
      <div class="brand-text">
        <h1>Guida al funzionamento</h1>
        <div class="sub">Come il sistema NBA prioritizza clienti e lead</div>
      </div>
    </div>
    <div class="actions">
      <a class="home-link" href="/lab/" title="NBA Studio">
        <span class="msi">arrow_back</span><span class="home-link-lbl"> NBA Studio</span>
      </a>
      <span class="user-chip" id="user-chip"><span class="msi">person</span> …</span>
    </div>
  </header>

  <div class="guida-layout">
    <nav class="guida-toc" id="toc">
      <div class="toc-title">Sommario</div>
      <a href="#intro">Introduzione</a>
      <a href="#cliente">Parte 1 — Il cliente</a>
      <a href="#cliente-segnali" class="lvl2">I segnali (trigger)</a>
      <a href="#cliente-score" class="lvl2">Il punteggio</a>
      <a href="#cliente-tier" class="lvl2">I livelli di priorità</a>
      <a href="#cliente-override" class="lvl2">Le regole di eccezione</a>
      <a href="#cliente-categoria" class="lvl2">Categoria strategica</a>
      <a href="#cliente-azione" class="lvl2">Azione e canale</a>
      <a href="#cliente-esempio" class="lvl2">Un esempio concreto</a>
      <a href="#lead">Parte 2 — Il lead</a>
      <a href="#uso">Parte 3 — Uso quotidiano</a>
    </nav>

    <main class="guida-body">
      <h2 id="intro">Introduzione</h2>
      <p>Il sistema NBA (Next Best Action) risponde ogni giorno a tre domande operative:
      <strong>chi contattare prima?</strong> <strong>Con quale messaggio?</strong>
      <strong>Attraverso quale canale?</strong></p>
      <p>Il risultato è una lista ordinata che assegna a ciascun soggetto una
      <strong>priorità</strong> (quanto è urgente), un'<strong>azione consigliata</strong>
      (cosa fare) e un <strong>canale preferito</strong> (come contattarlo).
      Il sistema gestisce due tipologie distinte, con logiche diverse:
      i <strong>clienti esistenti</strong> (già in portafoglio) e i
      <strong>lead</strong> (potenziali clienti che hanno manifestato interesse).</p>
      <div class="live-banner" id="live-banner">
        <span class="msi">sensors</span>
        <div>I numeri <span class="live">evidenziati</span> in questa pagina sono letti
        in tempo reale dalla configurazione attiva del sistema: se la configurazione
        cambia, questa guida si aggiorna da sola.</div>
      </div>
      <div class="guida-note"><strong>Chi non entra in lista.</strong>
      Un cliente senza telefono né email registrati non compare nella lista NBA
      (non è contattabile). Un lead senza consenso marketing non viene elaborato
      e non compare in nessuna lista.</div>

      <h2 id="cliente">Parte 1 — Il cliente esistente</h2>

      <h3 id="cliente-segnali">Passo 1 — Il sistema rileva i segnali (trigger)</h3>
      <p>Il motore analizza i dati già presenti nel sistema e identifica i segnali
      di attenzione attivi. Non tutti pesano allo stesso modo: quelli legati a
      urgenza economica (insoluti, scadenze) hanno precedenza su quelli
      relazionali (compleanni, anniversari).</p>
      <table>
        <thead><tr><th>#</th><th>Segnale</th><th>Quando si attiva</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Premio non pagato</td><td>C'è un insoluto, contano i giorni di ritardo accumulati</td></tr>
          <tr><td>2</td><td>Polizza in scadenza</td><td>Scadenza nei prossimi 45 giorni, con 4 livelli di urgenza (7 / 14 / 30 / 45 giorni)</td></tr>
          <tr><td>3</td><td>Rischio abbandono (churn)</td><td>La probabilità di abbandono stimata sul contratto supera la soglia attuale del <span class="live" data-cfg="thresholds.HIGH_CHURN_THRESHOLD" data-fmt="pct">—</span></td></tr>
          <tr><td>4</td><td>Sinistro aperto</td><td>Pratica sinistro non ancora chiusa</td></tr>
          <tr><td>5</td><td>Reclamo aperto</td><td>Reclamo formale non ancora chiuso</td></tr>
          <tr><td>6</td><td>Gap di copertura</td><td>Prodotti assicurativi mancanti nel portafoglio</td></tr>
          <tr><td>7</td><td>Campagna commerciale attiva</td><td>Campagna di marketing attiva sul cliente</td></tr>
          <tr><td>8</td><td>Preventivo non concluso</td><td>Preventivo salvato non ancora convertito</td></tr>
          <tr><td>9</td><td>Punti Viva in scadenza</td><td>Punti del programma fedeltà che stanno per scadere</td></tr>
          <tr><td>10</td><td>Punti Viva non utilizzati</td><td>Saldo superiore a 1.000 punti non riscattati</td></tr>
          <tr><td>11</td><td>Check-up non eseguito</td><td>Analisi dei bisogni assicurativi mai effettuata</td></tr>
          <tr><td>12</td><td>Non iscritto al programma Viva</td><td>Cliente non ancora iscritto al programma fedeltà</td></tr>
          <tr><td>13</td><td>Contatto assente</td><td>Nessuna interazione da più di <span class="live" data-cfg="thresholds.NO_CONTACT_DAYS_THRESHOLD">—</span> giorni</td></tr>
          <tr><td>14</td><td>Compleanno imminente</td><td>Compleanno entro i prossimi 7 giorni</td></tr>
          <tr><td>15</td><td>Anniversario cliente</td><td>Anniversario dell'attivazione del rapporto, entro 30 giorni</td></tr>
        </tbody>
      </table>

      <h3 id="cliente-score">Passo 2 — Il calcolo del punteggio (score 0–100)</h3>
      <p>Ogni cliente riceve un punteggio costruito su <strong>quattro dimensioni</strong>.
      Quanto pesa ciascuna dimensione è una scelta di configurazione, non una
      costante: i pesi qui sotto sono <strong>quelli attivi in questo momento</strong>.</p>
      <div class="widget">
        <div class="w-title"><span class="msi">tune</span> I pesi attuali delle dimensioni — cliente</div>
        <div id="w-client-weights"><div class="w-error">Caricamento…</div></div>
        <div class="w-hint">Percentuali normalizzate per leggibilità. I pesi si modificano
        dalla pagina di configurazione; la lista si riordina di conseguenza.</div>
      </div>
      <table>
        <thead><tr><th>Dimensione</th><th>Cosa misura</th></tr></thead>
        <tbody>
          <tr><td>Urgenza</td><td>Quanto è urgente agire: insoluto, scadenza imminente, rischio abbandono, pratiche aperte</td></tr>
          <tr><td>Valore economico</td><td>Quanto vale il cliente: premi, anzianità, numero polizze, redditività</td></tr>
          <tr><td>Opportunità commerciale</td><td>Quanto c'è da sviluppare: gap di copertura, campagne, preventivi aperti</td></tr>
          <tr><td>Recency contatto</td><td>Da quanto tempo il cliente non viene contattato</td></tr>
        </tbody>
      </table>
      <p>Al punteggio pesato si aggiungono due piccoli correttivi: un
      <strong>bonus multi-trigger</strong> se più segnali sono attivi
      contemporaneamente, e un <strong>modificatore relazionale</strong> legato a
      compleanno o anniversario imminenti.</p>

      <h3 id="cliente-tier">Passo 3 — La classificazione in livelli (tier)</h3>
      <p>Il punteggio viene tradotto in un livello di priorità operativa.
      Anche le soglie sono configurabili: quelle mostrate sono le attuali.
      Prova a muovere lo slider:</p>
      <div class="widget">
        <div class="w-title"><span class="msi">speed</span> Dal punteggio al tier</div>
        <div class="tier-track" id="tier-track"></div>
        <input type="range" min="0" max="100" value="70" class="tier-slider" id="tier-slider" />
        <div class="tier-out">
          <span class="tier-score" id="tier-score">70</span>
          <span class="tier-chip" id="tier-chip">—</span>
          <span id="tier-desc" style="color:var(--muted)"></span>
        </div>
      </div>
      <table>
        <thead><tr><th>Livello</th><th>Soglia attuale</th><th>Significato operativo</th></tr></thead>
        <tbody>
          <tr><td><strong style="color:#E80E3F">CRITICAL</strong></td><td>≥ <span class="live" data-cfg="tiers.CRITICAL">—</span></td><td>Azione immediata — contattare nella giornata</td></tr>
          <tr><td><strong style="color:#F59E0B">HIGH</strong></td><td>≥ <span class="live" data-cfg="tiers.HIGH">—</span></td><td>Alta priorità — contattare entro 24–48 ore</td></tr>
          <tr><td><strong style="color:#00B5A3">MEDIUM</strong></td><td>≥ <span class="live" data-cfg="tiers.MEDIUM">—</span></td><td>Priorità media — pianificare il contatto nella settimana</td></tr>
          <tr><td><strong style="color:#6b7280">LOW</strong></td><td>sotto la soglia MEDIUM</td><td>Bassa urgenza — gestione ordinaria</td></tr>
        </tbody>
      </table>
      <p>Il tier determina <strong>quando</strong> agire. La categoria strategica
      (Passo 4) determina <strong>come</strong> agire.</p>

      <h3 id="cliente-override">⚠ Quando il sistema scavalca il punteggio: le regole di eccezione</h3>
      <p>In tre situazioni specifiche il sistema applica regole che modificano il
      risultato indipendentemente dal punteggio calcolato. Sono queste regole a
      spiegare i casi che a prima vista sembrano «fuori posto» nella lista.</p>
      <table>
        <thead><tr><th>Regola</th><th>Condizione</th><th>Effetto</th></tr></thead>
        <tbody>
          <tr>
            <td>Sinistro o reclamo aperto</td>
            <td>Il cliente ha una pratica sinistro o un reclamo non chiusi</td>
            <td>L'azione primaria diventa la <strong>gestione della relazione</strong> (aggiornamento sulla pratica), prima di qualsiasi altra azione — perfino del sollecito di pagamento</td>
          </tr>
          <tr>
            <td>Churn elevato + scadenza imminente</td>
            <td>Rischio abbandono sopra soglia su una polizza <em>che è anche in scadenza</em></td>
            <td>Lo score viene portato almeno alla soglia CRITICAL (<span class="live" data-cfg="tiers.CRITICAL">—</span>) e l'azione primaria diventa la <strong>prevenzione dell'abbandono</strong></td>
          </tr>
          <tr>
            <td>Churn elevato (in generale)</td>
            <td>Rischio abbandono sopra soglia su almeno una polizza</td>
            <td>Cross-sell, iscrizione Viva e check-up vengono <strong>soppressi</strong>: il sistema si concentra solo sulla fidelizzazione</td>
          </tr>
        </tbody>
      </table>
      <div class="guida-note"><strong>Ordine delle azioni.</strong> A parità di
      condizioni l'azione primaria segue questa precedenza: pratica aperta →
      prevenzione abbandono (se scatta l'eccezione) → sollecito pagamento →
      rinnovo → sviluppo commerciale → relazione.</div>

      <h3 id="cliente-categoria">Passo 4 — La categoria strategica</h3>
      <table>
        <thead><tr><th>Categoria</th><th>Quando si attiva</th><th>Obiettivo</th></tr></thead>
        <tbody>
          <tr><td><strong>Retention</strong></td><td>Insoluto, polizza in scadenza, rischio abbandono, sinistro o reclamo aperto</td><td>Trattenere il cliente ed evitare la perdita della polizza</td></tr>
          <tr><td><strong>Growth</strong></td><td>Gap di copertura, campagna attiva, preventivo sospeso, programma Viva, check-up</td><td>Sviluppare il portafoglio e aumentare il valore del cliente</td></tr>
          <tr><td><strong>Service</strong></td><td>Nessun segnale urgente o commerciale attivo</td><td>Mantenere la relazione e presidiare il contatto</td></tr>
        </tbody>
      </table>
      <p>La categoria <strong>Retention ha sempre precedenza su Growth</strong>:
      se un cliente ha sia un rinnovo imminente che un gap di copertura, il
      sistema propone prima il rinnovo.</p>

      <h3 id="cliente-azione">Passo 5 — L'azione raccomandata e il canale</h3>
      <p>Il sistema genera automaticamente il testo dell'azione in italiano
      («Rinnovo urgente AUTO — scadenza tra 5 giorni (€1.100/anno)») e seleziona
      il canale di contatto. La <strong>preferenza di canale registrata in
      anagrafica vince sempre</strong>; se quel canale non è disponibile, il
      sistema scala secondo quest'ordine:</p>
      <div class="widget">
        <div class="w-title"><span class="msi">alt_route</span> Ordine di fallback del canale</div>
        <div class="chan-row"><span class="chan-cat">Retention / Conversion</span>
          <span class="chan-step"><span class="msi">call</span>Telefono</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">chat</span>WhatsApp</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">sms</span>SMS</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">mail</span>Email</span></div>
        <div class="chan-row"><span class="chan-cat">Growth / Nurturing</span>
          <span class="chan-step"><span class="msi">mail</span>Email</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">chat</span>WhatsApp</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">sms</span>SMS</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">call</span>Telefono</span></div>
        <div class="chan-row"><span class="chan-cat">Service</span>
          <span class="chan-step"><span class="msi">chat</span>WhatsApp</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">sms</span>SMS</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">call</span>Telefono</span><span class="chan-arr">→</span>
          <span class="chan-step"><span class="msi">mail</span>Email</span></div>
        <div class="w-hint">WhatsApp richiede che il numero sia presente e che il
        canale sia abilitato per il cliente. Il canale preferito è modificabile in
        anagrafica: la successiva elaborazione recepisce il cambiamento.</div>
      </div>

      <h3 id="cliente-esempio">Un esempio concreto, calcolato adesso</h3>
      <p>Questo esempio non è disegnato a mano: è <strong>calcolato in questo
      momento dal motore reale</strong> con la configurazione attiva, su un
      cliente dimostrativo.</p>
      <div class="widget">
        <div class="w-title"><span class="msi">person_search</span> Cliente demo — il percorso del punteggio</div>
        <div id="w-demo"><div class="w-error">Calcolo in corso…</div></div>
      </div>

      <h2 id="lead">Parte 2 — Il lead</h2>
      <p>Con un cliente il sistema ragiona su un rapporto già in essere. Con un
      lead <strong>il tempo è il fattore dominante</strong>: un potenziale cliente
      che ha richiesto un preventivo si raffredda rapidamente. La logica è
      costruita attorno all'urgenza temporale, non al valore del portafoglio.</p>
      <h3>I segnali del lead</h3>
      <table>
        <thead><tr><th>Segnale</th><th>Quando si attiva</th></tr></thead>
        <tbody>
          <tr><td>Nuovo lead</td><td>Richiesta arrivata da meno di ~<span class="live" data-cfg="thresholds.LEAD_NEW_HOURS_THRESHOLD" data-fmt="days-from-hours">—</span> giorni. Più è recente, più alta è l'urgenza.</td></tr>
          <tr><td>Lead fermo</td><td>Richiesta da più di <span class="live" data-cfg="thresholds.LEAD_STALE_DAYS_THRESHOLD">—</span> giorni <em>senza nessun contatto registrato</em>. Rischio perdita elevato.</td></tr>
          <tr><td>Copertura imminente</td><td>Decorrenza richiesta entro <span class="live" data-cfg="thresholds.LEAD_COVERAGE_START_SOON_DAYS">—</span> giorni. Finestra temporale stretta.</td></tr>
          <tr><td>Preventivo disponibile</td><td>È già stato generato un preventivo: l'azione è il follow-up.</td></tr>
          <tr><td>Preventivo di alto valore</td><td>Il preventivo supera <span class="live" data-cfg="thresholds.LEAD_HIGH_VALUE_PREMIUM_THRESHOLD" data-fmt="eur">—</span>: riceve un peso aggiuntivo.</td></tr>
        </tbody>
      </table>
      <h3>Il punteggio del lead — tre dimensioni</h3>
      <p>A differenza del cliente (4 dimensioni), il lead viene valutato su
      <strong>3 dimensioni</strong>: urgenza (freschezza della richiesta o
      imminenza della decorrenza), valore (entità del preventivo) e timing
      (da quanto non viene contattato).
      <span id="lead-weights-phrase"></span></p>
      <div class="widget">
        <div class="w-title"><span class="msi">tune</span> I pesi attuali delle dimensioni — lead</div>
        <div id="w-lead-weights"><div class="w-error">Caricamento…</div></div>
        <div class="w-hint">Anche questi pesi sono configurabili e possono cambiare.</div>
      </div>
      <h3>Categorie e azioni del lead</h3>
      <table>
        <thead><tr><th>Categoria</th><th>Quando si attiva</th><th>Esempio di azione</th></tr></thead>
        <tbody>
          <tr><td><strong>Conversion</strong></td><td>Lead nuovo, preventivo disponibile, copertura imminente</td><td>«Primo contatto — richiesta AUTO ricevuta 2 ore fa» · «Presentare preventivo AUTO €1.200/anno»</td></tr>
          <tr><td><strong>Nurturing</strong></td><td>Lead fermo senza risposta</td><td>«Contattare urgentemente — richiesta HOME ricevuta 12 giorni fa senza risposta»</td></tr>
        </tbody>
      </table>
      <p>Il canale predefinito per i lead è il <strong>telefono</strong>, salvo
      diversa indicazione nella scheda lead.</p>

      <h2 id="uso">Parte 3 — Come usare la lista ogni giorno</h2>
      <p>La lista NBA è uno strumento operativo, non un obbligo: supporta le
      decisioni quotidiane con i dati, non sostituisce il giudizio dell'operatore.</p>
      <table>
        <thead><tr><th>#</th><th>Abitudine</th><th>Perché</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Apri la lista a inizio giornata</td><td>È il punto di partenza: la lista riflette i dati più aggiornati</td></tr>
          <tr><td>2</td><td>Parti dai CRITICAL</td><td>Sono i casi che richiedono azione immediata: insoluti, scadenze, churn alto</td></tr>
          <tr><td>3</td><td>Leggi l'azione suggerita prima di chiamare</td><td>Contiene già il motivo del contatto e le informazioni chiave (prodotto, premio, scadenza)</td></tr>
          <tr><td>4</td><td>Verifica il canale consigliato</td><td>Tiene già conto della preferenza del cliente; se hai informazioni più fresche, aggiorna l'anagrafica</td></tr>
          <tr><td>5</td><td>Registra l'esito del contatto</td><td>Alimenta i dati della prossima elaborazione: un MEDIUM oggi può essere CRITICAL domani</td></tr>
        </tbody>
      </table>
      <div class="guida-note"><strong>Un cliente sembra fuori posto?</strong>
      Controlla se è soggetto a una regola di eccezione
      (<a href="#cliente-override">sezione dedicata</a>): un CRITICAL
      «inspiegabile» è quasi sempre un churn elevato con polizza in scadenza,
      e un cliente senza proposte commerciali è quasi sempre un churn elevato
      con le azioni di sviluppo soppresse.</div>
    </main>
  </div>

  <div class="toast" id="toast"></div>
  <script src="/lab/guida.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verifica che il server la serva**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:$PORT/lab/guida.html
```
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add tangible_lab/static/guida.html
git commit -m "Guida: pagina 'Come funziona' con contenuti corretti"
```

---

### Task 3: Logica — `guida.js`

**Files:**
- Create: `tangible_lab/static/guida.js`

- [ ] **Step 1: Crea il file con questo contenuto**

```javascript
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
      cross_sell_gaps: ["CASA"],
      policies: [
        { policy_number: "P-001", product: "AUTO", premium: 1100, expiry_date: iso(10), churn_rate: 0.05 },
        { policy_number: "P-002", product: "VITA", premium: 600, expiry_date: iso(200), churn_rate: 0.05 },
      ],
    };
  }

  const DEMO_FACTS = [
    ["badge", "Maria Rossi — cliente da 8 anni"],
    ["shield", "2 polizze: AUTO (€1.100) in scadenza tra 10 giorni, VITA (€600)"],
    ["report", "Gap di copertura: CASA"],
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
```

- [ ] **Step 2: Verifica che gli endpoint usati rispondano come atteso**

```bash
curl -s http://127.0.0.1:$PORT/config | python3 -c "import json,sys; c=json.load(sys.stdin); print('client_weights OK' if 'value' in c['client_weights']['urgency'] else 'SHAPE DIVERSA')"
curl -s -X POST http://127.0.0.1:$PORT/lab/breakdown/client -H 'Content-Type: application/json' \
  -d '{"client":{"client_id":"C-DEMO","email":"a@b.it","phone":"+39 333","preferred_channel":"PHONE","whatsapp_enabled":true,"last_contact_days":95,"customer_tenure_years":8,"active_policies_count":2,"checkup_done":true,"viva_enrolled":true,"cross_sell_gaps":["CASA"],"policies":[{"policy_number":"P-001","product":"AUTO","premium":1100,"expiry_date":"<OGGI+10>","churn_rate":0.05}]}}' \
  | python3 -m json.tool | head -20
```
Expected: `client_weights OK`; il breakdown restituisce `contributions` con 4 factor e `final_score` numerico. (`<OGGI+10>` = data ISO di oggi + 10 giorni.)

- [ ] **Step 3: Commit**

```bash
git add tangible_lab/static/guida.js
git commit -m "Guida: valori live da /config + widget pesi, tier e esempio demo"
```

---

### Task 4: Link "Guida" negli header

**Files:**
- Modify: `tangible_lab/static/studio.js:2377-2383` (accanto al link Check-up iniettato)
- Modify: `tangible_lab/static/checkup.html:20-31` (header `.actions`)
- Modify: `tangible_lab/static/admin.html` (header `.actions`, stesso pattern)

- [ ] **Step 1: In `studio.js`, dopo il blocco che crea `checkupLink` (riga ~2383, subito dopo `headerActions.insertBefore(checkupLink, ...)`) aggiungi:**

```javascript
      // Link alla Guida "Come funziona" (per tutti gli utenti loggati)
      const guidaLink = document.createElement("a");
      guidaLink.className = "home-link";
      guidaLink.href = "/lab/guida.html";
      guidaLink.title = "Guida — come funziona l'algoritmo NBA";
      guidaLink.innerHTML = '<span class="msi">menu_book</span><span class="home-link-lbl">Guida</span>';
      headerActions.insertBefore(guidaLink, headerActions.children[0]);
```

Nota ordine: inserendo dopo il blocco del checkupLink con `insertBefore(..., children[0])`, il link Guida appare a sinistra di Check-up. Va bene così.

- [ ] **Step 2: In `checkup.html`, dentro `<div class="actions">`, prima del link "NBA Studio" aggiungi:**

```html
      <a class="home-link" href="/lab/guida.html" title="Guida — come funziona l'algoritmo NBA">
        <span class="msi">menu_book</span><span class="home-link-lbl"> Guida</span>
      </a>
```

- [ ] **Step 3: In `admin.html`, individua l'header `<div class="actions">` e aggiungi lo stesso link del passo 2** (stesso markup, stessa posizione: prima del link di ritorno a NBA Studio).

- [ ] **Step 4: Verifica i file modificati**

```bash
grep -c "guida.html" tangible_lab/static/studio.js tangible_lab/static/checkup.html tangible_lab/static/admin.html
```
Expected: `1` per ciascun file.

- [ ] **Step 5: Commit**

```bash
git add tangible_lab/static/studio.js tangible_lab/static/checkup.html tangible_lab/static/admin.html
git commit -m "Guida: link nell'header di Studio, Check-up e Admin"
```

---

### Task 5: Verifica end-to-end (Playwright)

**Files:** nessuno (solo verifica).

Prerequisito: server locale attivo, utente `admin`/`admin` disponibile.

- [ ] **Step 1: Auth gate** — con Playwright apri `http://127.0.0.1:$PORT/lab/guida.html` da sessione non loggata. Expected: redirect a `/lab/login.html`.

- [ ] **Step 2: Login e contenuti live** — fai login, riapri la guida. Verifica:
  - i `span.live` non mostrano "—" ma numeri;
  - confronto incrociato: il valore mostrato per "CRITICAL" == `tiers.CRITICAL.value` in `curl -s http://127.0.0.1:$PORT/config`;
  - il widget pesi cliente mostra 4 barre, quello lead 3 barre, percentuali che sommano ~100;
  - lo slider cambia chip e colore attraversando le soglie;
  - l'esempio demo mostra tabella contributi + punteggio finale + chip tier + azione primaria.

- [ ] **Step 3: Console pulita** — controlla i messaggi console del browser. Expected: nessun errore JS.

- [ ] **Step 4: Mobile** — viewport 390×844, screenshot. Expected: sommario a chip orizzontali, tabelle leggibili, nessun overflow orizzontale.

- [ ] **Step 5: Link header** — dalla home Studio verifica presenza e funzionamento del link "Guida"; idem da Check-up e (da admin) da Admin.

- [ ] **Step 6: Commit finale eventuale** (solo se le verifiche hanno richiesto fix):

```bash
git add -A tangible_lab/static && git commit -m "Guida: fix da verifica end-to-end"
```
```

## Self-review

- **Spec coverage**: pagina narrativa ✓, TOC sticky ✓, 3 widget ✓, valori live ✓, 3 override (incluso sinistro/reclamo) ✓, frase lead dinamica ✓, error handling (/config giù, breakdown giù) ✓, date demo relative a oggi ✓, link header (index via studio.js, checkup, admin) ✓, auth gate ✓, mobile ✓, nessun file fuori da tangible_lab/ ✓.
- **Placeholder**: nessun TBD; tutti gli step con codice completo.
- **Coerenza tipi**: `cfgValue`/`tierFor`/`TIER_META`/`DIM_LABELS` definiti una volta e usati coerentemente; id HTML (`#w-client-weights`, `#w-lead-weights`, `#w-demo`, `#tier-*`, `#toc`, `#live-banner`, `#lead-weights-phrase`, `#user-chip`) tutti presenti nel markup del Task 2.
