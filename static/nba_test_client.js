// NBA_test client logic (editable policies/cases/campaigns/quotes)
(function(){
  'use strict';

  const el = (id)=>document.getElementById(id);
  const esc = (window.NBA && window.NBA.esc) ? window.NBA.esc : (s)=>String(s??'');
  const log = (window.NBA && window.NBA.log) ? window.NBA.log : console.log;

  log('[NBA UI] loaded: NBA_test client (editable arrays)');

  // Canonical policy products (must match cross_sell_gaps)
  const PRODUCTS = ["HOME", "AUTO", "VITA", "PET"];
  const PRODUCT_SET = new Set(PRODUCTS);

  const getMulti = (id)=>Array.from(el(id)?.selectedOptions||[]).map(o=>o.value);

  function populateCrossSellGaps(){
    const sel = el('cross_sell_gaps');
    if(!sel) return;
    const current = new Set(getMulti('cross_sell_gaps').map(x=>String(x).toUpperCase()));
    sel.innerHTML = PRODUCTS.map(p=>`<option value="${p}" ${current.has(p)?'selected':''}>${p}</option>`).join('');
  }

  function todayPlus(days){
    const d=new Date();
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  }

  const parseOptInt = (v)=>{
    v=(v??'').toString().trim();
    if(!v) return null;
    const n=parseInt(v,10);
    return Number.isFinite(n)?n:null;
  };

  const parseOptFloat = (v)=>{
    v=(v??'').toString().trim();
    if(!v) return null;
    const n=parseFloat(v);
    return Number.isFinite(n)?n:null;
  };

  const parseCsvInts = (v)=>{
    v=(v??'').toString().trim();
    if(!v) return [];
    return v.split(',').map(x=>parseInt(x.trim(),10)).filter(n=>Number.isFinite(n));
  };

  // ---------- Row factories ----------
  function addPolicyRow(p){
    const tbody = el('policiesTable')?.querySelector('tbody');
    if(!tbody) return;

    const tr=document.createElement('tr');
    const policy_number = (p && p.policy_number) || ('P'+Math.floor(Math.random()*9000+1000));
    const product = String((p && p.product) || 'AUTO').toUpperCase();
    const premium = (p && p.premium!=null) ? p.premium : 900;
    const expiry_date = (p && p.expiry_date) || todayPlus(20);
    const churn_rate = (p && p.churn_rate!=null) ? p.churn_rate : 0.35;

    tr.innerHTML = `
      <td><input class="pn" value="${esc(policy_number)}"></td>
      <td><select class="prod">${PRODUCTS.map(x=>`<option value="${x}" ${x===product?'selected':''}>${x}</option>`).join('')}</select></td>
      <td><input class="prem" type="number" value="${premium}" min="0"></td>
      <td><input class="exp" type="date" value="${expiry_date}"></td>
      <td><input class="churn" type="number" value="${churn_rate}" min="0" max="1" step="0.01"></td>
      <td><button class="btnRemoveRow" type="button">Remove</button></td>
    `;

    tbody.appendChild(tr);
  }

  function addClaimRow(c){
    const tbody = el('casesTable')?.querySelector('tbody');
    if(!tbody) return;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>CLAIM</td>
      <td><input class="status" value="${esc((c&&c.status)||'OPEN')}"></td>
      <td><input class="opened" type="date" value="${(c&&c.opened_date)||todayPlus(-10)}"></td>
      <td><input class="ref" value="${esc((c&&c.reference_id)||'')}"></td>
      <td><button class="btnRemoveRow" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  function addComplaintRow(c){
    const tbody = el('casesTable')?.querySelector('tbody');
    if(!tbody) return;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>COMPLAINT</td>
      <td><input class="status" value="${esc((c&&c.status)||'OPEN')}"></td>
      <td><input class="opened" type="date" value="${(c&&c.opened_date)||todayPlus(-5)}"></td>
      <td><input class="ref" value="${esc((c&&c.reference_id)||'')}"></td>
      <td><button class="btnRemoveRow" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  function addCampaignRow(x){
    const tbody = el('campaignsTable')?.querySelector('tbody');
    if(!tbody) return;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input class="cid" value="${esc((x&&x.campaign_id)||('CAMP'+Math.floor(Math.random()*900+100)))}"></td>
      <td><input class="name" value="${esc((x&&x.name)||'Campagna Demo')}"></td>
      <td><input class="prod" value="${esc((x&&x.product_scope)||'HOME')}"></td>
      <td><input class="end" type="date" value="${(x&&x.end_date)||todayPlus(20)}"></td>
      <td><button class="btnRemoveRow" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  function addPendingQuoteRow(q){
    const tbody = el('quotesTable')?.querySelector('tbody');
    if(!tbody) return;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input class="qid" value="${esc((q&&q.quote_id)||('Q'+Math.floor(Math.random()*9000+1000)))}"></td>
      <td><input class="prod" value="${esc((q&&q.product)||'VITA')}"></td>
      <td><input class="saved" type="date" value="${(q&&q.saved_at)||todayPlus(-5)}"></td>
      <td><input class="start" type="date" value="${(q&&q.coverage_start_date)||todayPlus(15)}"></td>
      <td><input class="status" value="${esc((q&&q.status)||'PENDING')}"></td>
      <td><button class="btnRemoveRow" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  function buildPayload(){
    const policies = Array.from(el('policiesTable')?.querySelectorAll('tbody tr')||[]).map(tr=>({
      policy_number: tr.querySelector('.pn')?.value.trim() || 'P0000',
      product: tr.querySelector('.prod')?.value.trim() || 'AUTO',
      premium: parseFloat(tr.querySelector('.prem')?.value || '0') || 0,
      expiry_date: tr.querySelector('.exp')?.value || todayPlus(30),
      churn_rate: (tr.querySelector('.churn')?.value ?? '').toString().trim()==='' ? null : parseFloat(tr.querySelector('.churn').value)
    }));

    // SANITY_CHECK_PRODUCTS: prevent sending policies with unknown product
    for(const pp of policies){
      const prod = String(pp.product||'').toUpperCase();
      if(!PRODUCT_SET.has(prod)){
        throw new Error('Invalid policy product: '+prod+' (allowed: '+Array.from(PRODUCT_SET).join(',')+')');
      }
      pp.product = prod;
    }

    const caseRows = Array.from(el('casesTable')?.querySelectorAll('tbody tr')||[]);
    const claims=[]; const complaints=[];
    caseRows.forEach(tr=>{
      const type = tr.children[0]?.textContent.trim();
      const status = tr.querySelector('.status')?.value.trim() || 'OPEN';
      const opened_date = tr.querySelector('.opened')?.value || todayPlus(-1);
      const reference_id = tr.querySelector('.ref')?.value.trim() || '';
      const obj = {status, opened_date, reference_id};
      if(type==='CLAIM') claims.push(obj); else complaints.push(obj);
    });

    const campaigns = Array.from(el('campaignsTable')?.querySelectorAll('tbody tr')||[]).map(tr=>({
      campaign_id: tr.querySelector('.cid')?.value.trim() || '',
      name: tr.querySelector('.name')?.value.trim() || '',
      product_scope: tr.querySelector('.prod')?.value.trim() || '',
      end_date: tr.querySelector('.end')?.value || ''
    }));

    const quotes = Array.from(el('quotesTable')?.querySelectorAll('tbody tr')||[]).map(tr=>({
      quote_id: tr.querySelector('.qid')?.value.trim() || '',
      product: tr.querySelector('.prod')?.value.trim() || '',
      saved_at: tr.querySelector('.saved')?.value || '',
      coverage_start_date: tr.querySelector('.start')?.value || '',
      status: tr.querySelector('.status')?.value.trim() || ''
    }));

    const owned = new Set(policies.map(p=>String(p.product||'').toUpperCase()));
    const gaps = getMulti('cross_sell_gaps').map(x=>String(x).toUpperCase()).filter(g=>g && !owned.has(g));

    return {
      client_id: el('client_id').value.trim() || 'C000',
      email: (el('email').value.trim() || null),
      phone: (el('phone').value.trim() || null),
      preferred_channel: el('preferred_channel').value || null,
      whatsapp_enabled: el('whatsapp_enabled').value===''?null:(el('whatsapp_enabled').value==='true'),
      last_contact_days: parseOptInt(el('last_contact_days').value),
      birthday_days: parseOptInt(el('birthday_days').value),
      anniversary_days: parseOptInt(el('anniversary_days').value),
      unpaid_days: parseCsvInts(el('unpaid_days').value),
      cross_sell_gaps: gaps,
      viva_points: parseOptFloat(el('viva_points').value),
      viva_points_expiring: parseOptInt(el('viva_points_expiring').value),
      viva_enrolled: el('viva_enrolled').value===''?null:(el('viva_enrolled').value==='true'),
      checkup_done: el('checkup_done').value===''?null:(el('checkup_done').value==='true'),
      customer_tenure_years: parseOptFloat(el('customer_tenure_years').value),
      active_policies_count: parseOptInt(el('active_policies_count').value),
      agency_profitability: parseOptFloat(el('agency_profitability').value),
      company_profitability_sp: parseOptFloat(el('company_profitability_sp').value),
      auto_premium_normalized: parseOptFloat(el('auto_premium_normalized').value),
      auto_guarantees_weight_vct: parseOptFloat(el('auto_guarantees_weight_vct').value),
      non_auto_premium_total: parseOptFloat(el('non_auto_premium_total').value),
      policies: policies.length?policies:[],
      claims: claims.length?claims:null,
      complaints: complaints.length?complaints:null,
      active_campaigns: campaigns.length?campaigns:null,
      pending_quotes: quotes.length?quotes:null
    };
  }

  function renderActions(actions){
    const a = Array.isArray(actions)?actions:[];
    if(!a.length) return '<div class="hint">Nessuna azione</div>';
    const sorted=a.slice().sort((x,y)=>{
      const xp=(x.priority_within_task==='PRIMARY'||x.primary===true);
      const yp=(y.priority_within_task==='PRIMARY'||y.primary===true);
      if(xp!==yp) return xp?-1:1;
      return 0;
    });
    return sorted.map(x=>{
      const isP=(x.priority_within_task==='PRIMARY'||x.primary===true);
      return `<div class="actionLine ${isP?'actionPrimary':''}">${isP?'⭐ ':''}<b>[${esc(x.action_category)}]</b> ${esc(x.recommended_action)} → ${esc(x.recommended_channel)}</div>`;
    }).join('');
  }

  async function run(){
    const debug = el('debug')?.checked;
    let payload;
    try{
      payload = buildPayload();
    }catch(e){
      console.error(e);
      el('meta').textContent = 'Errore input: '+(e?.message||e);
      return;
    }
    el('reqJson').textContent = JSON.stringify(payload,null,2);
    el('meta').textContent = 'Loading…';
    el('actions').innerHTML = '';
    try{
      const r = await fetch('/nba/client/test?debug='+(debug?'true':'false'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(r.status===204){
        el('meta').textContent='Nessuna NBA (204)';
        return;
      }
      if(!r.ok){
        const err = await r.json().catch(()=>({}));
        el('meta').textContent='Errore: '+(err.detail||r.status);
        return;
      }
      const data = await r.json();
      el('meta').innerHTML = 'score <b>'+data.priority_score+'</b> ('+data.priority_tier+') — <b>'+(data.strategic_category||'-')+'</b> — '+(data.presentation_mode||'-');
      el('actions').innerHTML = renderActions(data.recommended_actions);
    }catch(e){
      console.error(e);
      el('meta').textContent='Errore (vedi console)';
    }
  }

  function resetPrototype(){
    if(el('policiesTable')) el('policiesTable').querySelector('tbody').innerHTML='';
    if(el('casesTable')) el('casesTable').querySelector('tbody').innerHTML='';
    if(el('campaignsTable')) el('campaignsTable').querySelector('tbody').innerHTML='';
    if(el('quotesTable')) el('quotesTable').querySelector('tbody').innerHTML='';

    // seed
    addPolicyRow({policy_number:'P9991', product:'AUTO', premium:900, expiry_date: todayPlus(12), churn_rate: 0.81});
    addClaimRow({status:'OPEN', opened_date: todayPlus(-12), reference_id:'C-123456'});
    addCampaignRow({campaign_id:'CAMP101', name:'Promo Primavera', product_scope:'HOME', end_date: todayPlus(20)});
    addPendingQuoteRow({quote_id:'Q9001', product:'VITA', saved_at: todayPlus(-5), coverage_start_date: todayPlus(15), status:'PENDING'});

    populateCrossSellGaps();
    Array.from(el('cross_sell_gaps')?.options||[]).forEach(o=>{ o.selected = (o.value==='HOME' || o.value==='VITA'); });
  }

  function wireRemoveButtons(){
    document.addEventListener('click', (e)=>{
      const btn = e.target;
      if(btn && btn.classList && btn.classList.contains('btnRemoveRow')){
        const tr = btn.closest('tr');
        if(tr) tr.remove();
      }
    });
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    wireRemoveButtons();

    el('btnAddPolicy')?.addEventListener('click', ()=>addPolicyRow());
    el('btnAddClaim')?.addEventListener('click', ()=>addClaimRow());
    el('btnAddComplaint')?.addEventListener('click', ()=>addComplaintRow());
    el('btnAddCampaign')?.addEventListener('click', ()=>addCampaignRow());
    el('btnAddPendingQuote')?.addEventListener('click', ()=>addPendingQuoteRow());
    el('btnRun')?.addEventListener('click', run);

    resetPrototype();
    run();
  });
})();
