// NBA_sandbox page logic
(function(){
  const getMulti = (id)=>Array.from($(id)?.selectedOptions||[]).map(o=>o.value);

  'use strict';

  // Product list shared with cross_sell_gaps
    const PRODUCTS = ["HOME", "AUTO", "VITA", "PET"];
  const PRODUCT_SET = new Set(PRODUCTS);

  function populateCrossSellGaps(){
    const sel = $('cross_sell_gaps');
    if(!sel) return;
    const current = new Set(getMulti('cross_sell_gaps').map(x=>String(x).toUpperCase()));
    sel.innerHTML = PRODUCTS.map(p=>`<option value="${p}" ${current.has(p)?'selected':''}>${p}</option>`).join('');
  }



  const esc = window.NBA && window.NBA.esc ? window.NBA.esc : (s)=>String(s ?? '');

  let originalConfig = null;   // schema
  let currentConfig  = null;   // schema (mutable)
  let _timer = null;

  // ----------------- utils -----------------

  function $(id){ return document.getElementById(id); }

  function parseNum(v){
    if(v === null || v === undefined) return null;
    const s = String(v).trim();
    if(!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function parseIntNum(v){
    const n = parseNum(v);
    return n === null ? null : parseInt(String(n), 10);
  }

  function parseBool(v){
    if(typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if(s === 'true') return true;
    if(s === 'false') return false;
    return null;
  }

  function parseCSVInts(v){
    const s = String(v ?? '').trim();
    if(!s) return [];
    return s.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{
      const n = parseInt(x,10);
      return Number.isFinite(n) ? n : null;
    }).filter(x=>x!==null);
  }

  function parseCSVStrings(v){
    const s = String(v ?? '').trim();
    if(!s) return [];
    return s.split(',').map(x=>x.trim()).filter(Boolean);
  }

  function isoDatePlus(days){
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function isoDateMinus(days){
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0,10);
  }

  // ----------------- config rendering -----------------

  function clearCfgMessages(){
    const s = $('cfgStatus');
    const e = $('cfgError');
    if(s) s.textContent='';
    if(e) e.textContent='';
  }
  function showCfgStatus(msg){ clearCfgMessages(); const s=$('cfgStatus'); if(s) s.textContent=msg||''; }
  function showCfgError(msg){ clearCfgMessages(); const e=$('cfgError'); if(e) e.textContent=msg||''; }

  function renderConfig(cfg){
    const container = $('cfgContainer');
    if(!container) return;
    container.innerHTML='';

    Object.keys(cfg || {}).forEach(sectionName=>{
      const section = cfg[sectionName];
      if(!section || typeof section !== 'object') return;

      const wrap = document.createElement('div');
      wrap.className = 'box';
      wrap.innerHTML = '<h4 style="margin-top:0">' + esc(sectionName) + '</h4>';
      container.appendChild(wrap);

      Object.keys(section).forEach(paramName=>{
        const node = section[paramName];
        if(typeof node !== 'object' || node === null || node.value === undefined) return;

        const value = node.value;
        const min   = (node.min  !== undefined) ? node.min  : 0;
        const max   = (node.max  !== undefined) ? node.max  : 100;
        const step  = (node.step !== undefined) ? node.step : 1;

        const id = sectionName + '__' + paramName;

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML =
          '<div>'+
            '<label for="'+esc(id)+'_num">'+esc(paramName)+'</label>'+
            (node.desc ? '<div class="desc">'+esc(node.desc)+'</div>' : '')+
          '</div>'+
          '<input id="'+esc(id)+'_num" type="number" value="'+esc(value)+'" step="'+esc(step)+'">'+
          '<input id="'+esc(id)+'_rng" type="range" value="'+esc(value)+'" min="'+esc(min)+'" max="'+esc(max)+'" step="'+esc(step)+'">'+
          '<div><code>'+esc(min)+'..'+esc(max)+'</code></div>';

        wrap.appendChild(row);

        const num = row.querySelector('#' + CSS.escape(id + '_num'));
        const rng = row.querySelector('#' + CSS.escape(id + '_rng'));

        const apply = (v)=>{
          const nv = Number.isFinite(+v) ? +v : +value;
          currentConfig[sectionName][paramName].value = nv;
          if(num) num.value = nv;
          if(rng) rng.value = nv;
          scheduleRecompute(false);
        };

        if(num) num.addEventListener('input', ()=>apply(num.value));
        if(rng) rng.addEventListener('input', ()=>apply(rng.value));
      });
    });
  }

  async function loadConfig(){
    clearCfgMessages();
    try{
      const r = await fetch('/config');
      if(!r.ok){
        showCfgError('Errore caricamento config ('+r.status+')');
        return;
      }
      originalConfig = await r.json();
      currentConfig = JSON.parse(JSON.stringify(originalConfig));
      renderConfig(currentConfig);
      scheduleRecompute(true);
    }catch(e){
      console.error(e);
      showCfgError('Impossibile raggiungere la API /config. Verifica che il server NBA sia in esecuzione.');
    }
  }

  async function saveConfig(){
    clearCfgMessages();
    try{
      const r = await fetch('/config', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(currentConfig)
      });
      if(!r.ok){
        const err = await r.json().catch(()=>({}));
        showCfgError('Save fallito: '+(err.detail || r.status));
        return;
      }
      showCfgStatus('✅ Config salvato (hot reload).');
      await loadConfig();
    }catch(e){
      console.error(e);
      showCfgError('Errore di rete');
    }
  }

  // ----------------- client/lead JSON builders -----------------

  function buildClient(){
    const client = {
      client_id: $('client_id')?.value || null,
      email: $('email')?.value || null,
      phone: $('phone')?.value || null,
      preferred_channel: $('preferred_channel')?.value || null,
      whatsapp_enabled: parseBool($('whatsapp_enabled')?.value),
      last_contact_days: parseIntNum($('last_contact_days')?.value),
      birthday_days: parseIntNum($('birthday_days')?.value),
      anniversary_days: parseIntNum($('anniversary_days')?.value),
      unpaid_days: parseCSVInts($('unpaid_days')?.value),
      cross_sell_gaps: (function(){
        const owned = new Set();
        try{ for(const tr of Array.from(document.querySelectorAll('#policiesTable tbody tr'))){ const v=tr.querySelector('select.p_product')?.value; if(v) owned.add(String(v).toUpperCase()); } }catch(e){}
        return getMulti('cross_sell_gaps').map(x=>String(x).toUpperCase()).filter(g=>g && !owned.has(g));
      })(),
      viva_points: parseIntNum($('viva_points')?.value),
      viva_points_expiring: parseIntNum($('viva_points_expiring')?.value),
      viva_enrolled: parseBool($('viva_enrolled')?.value),
      checkup_done: parseBool($('checkup_done')?.value),
      customer_tenure_years: parseNum($('customer_tenure_years')?.value),
      active_policies_count: parseIntNum($('active_policies_count')?.value),
      agency_profitability: parseNum($('agency_profitability')?.value),
      company_profitability_sp: parseNum($('company_profitability_sp')?.value),
      auto_premium_normalized: parseNum($('auto_premium_normalized')?.value),
      auto_guarantees_weight_vct: parseNum($('auto_guarantees_weight_vct')?.value),
      non_auto_premium_total: parseNum($('non_auto_premium_total')?.value),
      policies: [],
      claims: null,
      complaints: null,
      active_campaigns: null,
      pending_quotes: null
    };

    // policies
    const polRows = Array.from(document.querySelectorAll('#policiesTable tbody tr'));
    for(const tr of polRows){
      const policy_number = tr.querySelector('input.p_policy_number')?.value || '';
      const product = tr.querySelector('select.p_product')?.value || '';
      const prodU = String(product||'').toUpperCase();
      if(!PRODUCT_SET.has(prodU)) throw new Error('Invalid policy product: '+prodU+' (allowed: '+Array.from(PRODUCT_SET).join(',')+')');
      const premium = parseNum(tr.querySelector('input.p_premium')?.value) || 0;
      const expiry_date = tr.querySelector('input.p_expiry')?.value || isoDatePlus(30);
      const churn_rate_raw = tr.querySelector('input.p_churn')?.value;
      const churn_rate = (String(churn_rate_raw||'').trim()==='') ? null : parseNum(churn_rate_raw);
      client.policies.push({policy_number, product: prodU, premium, expiry_date, churn_rate});
    }

    // cases -> claims/complaints
    const caseRows = Array.from(document.querySelectorAll('#casesTable tbody tr'));
    const claims=[];
    const complaints=[];
    for(const tr of caseRows){
      const type = (tr.querySelector('select.c_type')?.value || 'CLAIM').toUpperCase();
      const status = tr.querySelector('input.c_status')?.value || 'OPEN';
      const opened_date = tr.querySelector('input.c_opened')?.value || isoDateMinus(10);
      const reference_id = tr.querySelector('input.c_ref')?.value || '';
      const item = {status, opened_date, reference_id};
      if(type==='COMPLAINT') complaints.push(item); else claims.push(item);
    }
    client.claims = claims.length ? claims : null;
    client.complaints = complaints.length ? complaints : null;

    // campaigns
    const campRows = Array.from(document.querySelectorAll('#campaignsTable tbody tr'));
    const campaigns=[];
    for(const tr of campRows){
      const campaign_id = tr.querySelector('input.k_campaign_id')?.value || '';
      const name = tr.querySelector('input.k_name')?.value || '';
      const product_scope = tr.querySelector('input.k_scope')?.value || '';
      const end_date = tr.querySelector('input.k_end')?.value || isoDatePlus(14);
      campaigns.push({campaign_id, name, product_scope, end_date});
    }
    client.active_campaigns = campaigns.length ? campaigns : null;

    // quotes
    const quoteRows = Array.from(document.querySelectorAll('#quotesTable tbody tr'));
    const quotes=[];
    for(const tr of quoteRows){
      const quote_id = tr.querySelector('input.q_quote_id')?.value || '';
      const product = tr.querySelector('input.q_product')?.value || '';
      const saved_at = tr.querySelector('input.q_saved')?.value || isoDateMinus(3);
      const coverage_start_date = tr.querySelector('input.q_cov')?.value || isoDatePlus(10);
      const status = tr.querySelector('input.q_status')?.value || 'PENDING';
      quotes.push({quote_id, product, saved_at, coverage_start_date, status});
    }
    client.pending_quotes = quotes.length ? quotes : null;

    return client;
  }

  function buildLead(){
    const lastc = $('lead_last_contact_days')?.value;
    const lead = {
      lead_id: $('lead_id')?.value || null,
      product: $('lead_product')?.value || null,
      marketing_consent: parseBool($('marketing_consent')?.value) || false,
      created_hours_ago: parseIntNum($('created_hours_ago')?.value) ?? 999999,
      last_contact_days: (String(lastc||'').trim()==='') ? null : parseIntNum(lastc),
      quote_premium: parseNum($('quote_premium')?.value),
      coverage_start_days: parseIntNum($('coverage_start_days')?.value),
      email: $('lead_email')?.value || null,
      phone: $('lead_phone')?.value || null,
      preferred_channel: $('lead_preferred_channel')?.value || null,
      whatsapp_enabled: parseBool($('lead_whatsapp_enabled')?.value)
    };
    return lead;
  }

  // ----------------- dynamic tables -----------------

  function addDeleteBtnCell(tr, onDel){
    const td=document.createElement('td');
    const b=document.createElement('button');
    b.type='button';
    b.textContent='X';
    b.addEventListener('click', ()=>{ tr.remove(); onDel && onDel(); });
    td.appendChild(b);
    tr.appendChild(td);
  }

  function addPolicyRow(sample){
    const tb=document.querySelector('#policiesTable tbody');
    if(!tb) return;
    const tr=document.createElement('tr');
    tr.innerHTML =
      '<td><input class="p_policy_number" value="'+esc(sample?.policy_number || 'P100')+'"></td>'+
      '<td><select class="p_product">'+PRODUCTS.map(p=>'<option value="'+p+'"'+(String(sample?.product||'AUTO').toUpperCase()===p?' selected':'')+'>'+p+'</option>').join('')+'</select></td>'+
      '<td><input class="p_premium" type="number" value="'+esc(sample?.premium ?? 900)+'"></td>'+
      '<td><input class="p_expiry" type="date" value="'+esc(sample?.expiry_date || isoDatePlus(30))+'"></td>'+
      '<td><input class="p_churn" type="number" step="0.01" value="'+esc(sample?.churn_rate ?? 0.3)+'"></td>';
    addDeleteBtnCell(tr, ()=>scheduleRecompute(false));
    tb.appendChild(tr);
  }

  function addCaseRow(type, sample){
    const tb=document.querySelector('#casesTable tbody');
    if(!tb) return;
    const tr=document.createElement('tr');
    tr.innerHTML =
      '<td><select class="c_type"><option value="CLAIM">CLAIM</option><option value="COMPLAINT">COMPLAINT</option></select></td>'+
      '<td><input class="c_status" value="'+esc(sample?.status || 'OPEN')+'"></td>'+
      '<td><input class="c_opened" type="date" value="'+esc(sample?.opened_date || isoDateMinus(10))+'"></td>'+
      '<td><input class="c_ref" value="'+esc(sample?.reference_id || 'C-123456')+'"></td>';
    tr.querySelector('select.c_type').value = (type || 'CLAIM');
    addDeleteBtnCell(tr, ()=>scheduleRecompute(false));
    tb.appendChild(tr);
  }

  function addCampaignRow(sample){
    const tb=document.querySelector('#campaignsTable tbody');
    if(!tb) return;
    const tr=document.createElement('tr');
    tr.innerHTML =
      '<td><input class="k_campaign_id" value="'+esc(sample?.campaign_id || 'CAMP101')+'"></td>'+
      '<td><input class="k_name" value="'+esc(sample?.name || 'Promo')+'"></td>'+
      '<td><input class="k_scope" value="'+esc(sample?.product_scope || 'AUTO')+'"></td>'+
      '<td><input class="k_end" type="date" value="'+esc(sample?.end_date || isoDatePlus(14))+'"></td>';
    addDeleteBtnCell(tr, ()=>scheduleRecompute(false));
    tb.appendChild(tr);
  }

  function addQuoteRow(sample){
    const tb=document.querySelector('#quotesTable tbody');
    if(!tb) return;
    const tr=document.createElement('tr');
    tr.innerHTML =
      '<td><input class="q_quote_id" value="'+esc(sample?.quote_id || 'Q9001')+'"></td>'+
      '<td><input class="q_product" value="'+esc(sample?.product || 'VITA')+'"></td>'+
      '<td><input class="q_saved" type="date" value="'+esc(sample?.saved_at || isoDateMinus(5))+'"></td>'+
      '<td><input class="q_cov" type="date" value="'+esc(sample?.coverage_start_date || isoDatePlus(15))+'"></td>'+
      '<td><input class="q_status" value="'+esc(sample?.status || 'PENDING')+'"></td>';
    addDeleteBtnCell(tr, ()=>scheduleRecompute(false));
    tb.appendChild(tr);
  }

  // ----------------- rendering outputs -----------------

  function renderActions(div, actions){
    const a = Array.isArray(actions) ? actions : [];
    if(!div) return;
    if(!a.length){
      div.innerHTML = '<div class="hint">Nessuna azione</div>';
      return;
    }

    const sorted = a.slice().sort((x,y)=>{
      const xp = (x.priority_within_task === 'PRIMARY' || x.primary === true);
      const yp = (y.priority_within_task === 'PRIMARY' || y.primary === true);
      if(xp !== yp) return xp ? -1 : 1;
      return 0;
    });

    div.innerHTML = sorted.map(x=>{
      const isP = (x.priority_within_task === 'PRIMARY' || x.primary === true);
      return (
        '<div class="actionLine '+(isP?'actionPrimary':'')+'">' +
          (isP ? '⭐ ' : '') +
          '<b>['+esc(x.action_category)+']</b> ' +
          esc(x.recommended_action) +
          ' → ' + esc(x.recommended_channel) +
        '</div>'
      );
    }).join('');
  }

  function setDiagnostics(hash){
    const h=$('cfgHash');
    if(h) h.textContent = hash || '-';
    const t=$('lastRefresh');
    if(t) t.textContent = new Date().toISOString();
  }

  // ----------------- recompute (hot reload) -----------------

  function scheduleRecompute(immediate){
    if(_timer) clearTimeout(_timer);
    const delay = immediate ? 0 : 250;
    _timer = setTimeout(recompute, delay);
  }

  async function recompute(){
    try{
      if(!currentConfig) return;

      const client = buildClient();
      const lead = buildLead();

      if($('clientJson')) $('clientJson').textContent = JSON.stringify(client, null, 2);
      if($('leadJson')) $('leadJson').textContent = JSON.stringify(lead, null, 2);

      // client preview
      const rc = await fetch('/nba/client/preview?debug=false', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({client, config: currentConfig})
      });

      if(rc.status === 204){
        if($('clientMeta')) $('clientMeta').textContent = 'Nessuna NBA (204)';
        if($('clientActions')) $('clientActions').innerHTML='';
      } else {
        const dc = await rc.json();
        if($('clientMeta')) $('clientMeta').textContent =
          'score ' + dc.priority_score + ' ('+dc.priority_tier+') — ' + (dc.strategic_category||'-') + ' — ' + (dc.presentation_mode||'-');
        renderActions($('clientActions'), dc.recommended_actions);
        setDiagnostics(dc.__config_hash);
      }

      // lead preview
      const rl = await fetch('/nba/lead/preview?debug=false', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({lead, config: currentConfig})
      });

      if(rl.status === 204){
        if($('leadMeta')) $('leadMeta').textContent = 'Nessuna NBA (204)';
        if($('leadActions')) $('leadActions').innerHTML='';
      } else {
        const dl = await rl.json();
        if($('leadMeta')) $('leadMeta').textContent =
          'score ' + dl.priority_score + ' ('+dl.priority_tier+') — ' + (dl.strategic_category||'-') + ' — ' + (dl.presentation_mode||'-');
        renderActions($('leadActions'), dl.recommended_actions);
        if(dl.__config_hash) setDiagnostics(dl.__config_hash);
      }

    }catch(e){
      console.error(e);
      if($('clientMeta')) $('clientMeta').textContent = 'Errore preview (vedi console)';
      if($('leadMeta')) $('leadMeta').textContent = 'Errore preview (vedi console)';
    }
  }

  // ----------------- reset helpers -----------------

  function resetClientSample(){
    $('client_id').value = 'C-TEST-001';
    $('email').value = 'cliente.test@email.it';
    $('phone').value = '3331234567';
    $('preferred_channel').value = 'PHONE';
    $('whatsapp_enabled').value = 'true';
    $('last_contact_days').value = '120';
    $('birthday_days').value = '3';
    $('anniversary_days').value = '10';
    $('unpaid_days').value = '32';
    populateCrossSellGaps();
    Array.from($('cross_sell_gaps')?.options||[]).forEach(o=>{o.selected=(o.value==='HOME'||o.value==='VITA');});
    $('viva_points').value = '1400';
    $('viva_points_expiring').value = '250';
    $('viva_enrolled').value = 'false';
    $('checkup_done').value = 'false';
    $('customer_tenure_years').value = '12';
    $('active_policies_count').value = '3';
    $('agency_profitability').value = '500';
    $('company_profitability_sp').value = '0.65';
    $('auto_premium_normalized').value = '900';
    $('auto_guarantees_weight_vct').value = '1.1';
    $('non_auto_premium_total').value = '1500';

    // clear tables
    document.querySelector('#policiesTable tbody').innerHTML='';
    document.querySelector('#casesTable tbody').innerHTML='';
    document.querySelector('#campaignsTable tbody').innerHTML='';
    document.querySelector('#quotesTable tbody').innerHTML='';

    addPolicyRow({policy_number:'P100', product:'AUTO', premium:900, expiry_date: isoDatePlus(10), churn_rate: 0.82});
    addPolicyRow({policy_number:'P200', product:'HOME', premium:1800, expiry_date: isoDatePlus(35), churn_rate: 0.25});
    addCaseRow('CLAIM', {status:'OPEN', opened_date: isoDateMinus(12), reference_id:'C-123456'});
    addCampaignRow({campaign_id:'CAMP101', name:'Promo Casa Primavera', product_scope:'HOME', end_date: isoDatePlus(20)});
    addQuoteRow({quote_id:'Q9001', product:'VITA', saved_at: isoDateMinus(5), coverage_start_date: isoDatePlus(15), status:'PENDING'});

    scheduleRecompute(true);
  }

  function resetLeadSample(){
    $('lead_id').value = 'L-TEST-001';
    $('lead_product').value = 'AUTO';
    $('marketing_consent').value = 'true';
    $('created_hours_ago').value = '6';
    $('lead_last_contact_days').value = '';
    $('quote_premium').value = '900';
    $('coverage_start_days').value = '7';
    $('lead_email').value = 'lead.test@email.it';
    $('lead_phone').value = '3337778888';
    $('lead_preferred_channel').value = 'PHONE';
    $('lead_whatsapp_enabled').value = 'true';
    scheduleRecompute(true);
  }

  // ----------------- init -----------------

  window.addEventListener('DOMContentLoaded', ()=>{
    populateCrossSellGaps();
    // config buttons
    const bSave = $('btnCfgSave');
    const bReset = $('btnCfgReset');
    if(bSave) bSave.addEventListener('click', saveConfig);
    if(bReset) bReset.addEventListener('click', loadConfig);

    // client buttons
    $('btnAddPolicy')?.addEventListener('click', ()=>{ addPolicyRow({expiry_date: isoDatePlus(30)}); scheduleRecompute(false); });
    $('btnAddClaim')?.addEventListener('click', ()=>{ addCaseRow('CLAIM'); scheduleRecompute(false); });
    $('btnAddComplaint')?.addEventListener('click', ()=>{ addCaseRow('COMPLAINT'); scheduleRecompute(false); });
    $('btnAddCampaign')?.addEventListener('click', ()=>{ addCampaignRow(); scheduleRecompute(false); });
    $('btnAddPendingQuote')?.addEventListener('click', ()=>{ addQuoteRow(); scheduleRecompute(false); });
    $('btnClientReset')?.addEventListener('click', resetClientSample);

    // lead button
    $('btnLeadReset')?.addEventListener('click', resetLeadSample);

    // hot reload on any input changes in left panel
    document.querySelector('.panel.left')?.addEventListener('input', ()=>scheduleRecompute(false));
    document.querySelector('.panel.left')?.addEventListener('change', ()=>scheduleRecompute(false));

    // init samples
    resetClientSample();
    resetLeadSample();

    // load config schema + render sliders
    loadConfig();
  });

})()