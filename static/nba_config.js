// NBA_config page logic
(function(){
  'use strict';

  const esc = window.NBA && window.NBA.esc ? window.NBA.esc : (s)=>String(s ?? '');
  if(window.NBA && window.NBA.log) window.NBA.log('[NBA UI] loaded: NBA_config');

  let originalConfig = null;
  let currentConfig  = null;
  let _timer = null;

  function clearMessages(){
    const s = document.getElementById('status');
    const e = document.getElementById('error');
    if(s) s.textContent = '';
    if(e) e.textContent = '';
  }
  function showStatus(msg){
    clearMessages();
    const s = document.getElementById('status');
    if(s) s.textContent = msg || '';
  }
  function showError(msg){
    clearMessages();
    const e = document.getElementById('error');
    if(e) e.textContent = msg || '';
  }

  function renderConfig(cfg){
    const container = document.getElementById('container');
    if(!container) return;

    container.innerHTML = '';
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
          '<div>' +
            '<label for="'+esc(id)+'_num">'+esc(paramName)+'</label>' +
            (node.desc ? '<div class="desc">'+esc(node.desc)+'</div>' : '') +
          '</div>' +
          '<input id="'+esc(id)+'_num" type="number" value="'+esc(value)+'" step="'+esc(step)+'">' +
          '<input id="'+esc(id)+'_rng" type="range" value="'+esc(value)+'" min="'+esc(min)+'" max="'+esc(max)+'" step="'+esc(step)+'">' +
          '<div><code>'+esc(min)+'..'+esc(max)+'</code></div>';

        wrap.appendChild(row);

        const num = row.querySelector('#' + CSS.escape(id + '_num'));
        const rng = row.querySelector('#' + CSS.escape(id + '_rng'));

        const apply = (v)=>{
          const nv = Number.isFinite(+v) ? +v : +value;
          currentConfig[sectionName][paramName].value = nv;
          if(num) num.value = nv;
          if(rng) rng.value = nv;
          schedulePreview(false);
        };

        if(num) num.addEventListener('input', ()=>apply(num.value));
        if(rng) rng.addEventListener('input', ()=>apply(rng.value));
      });
    });
  }

  async function loadConfig(){
    clearMessages();
    try{
      const r = await fetch('/config');
      if(!r.ok){
        showError('Errore caricamento config (' + r.status + ')');
        return;
      }
      originalConfig = await r.json();
      currentConfig  = JSON.parse(JSON.stringify(originalConfig));
      renderConfig(currentConfig);
      initSamples();
      schedulePreview(true);
    }catch(e){
      console.error(e);
      showError('Impossibile raggiungere la API /config. Verifica che il server NBA sia in esecuzione.');
    }
  }

  async function saveConfig(){
    clearMessages();
    try{
      const r = await fetch('/config', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(currentConfig)
      });
      if(!r.ok){
        const err = await r.json().catch(()=>({}));
        showError('Save fallito: ' + (err.detail || r.status));
        return;
      }
      showStatus('✅ Config salvato (hot reload).');
      originalConfig = JSON.parse(JSON.stringify(currentConfig));
      schedulePreview(true);
    }catch(e){
      console.error(e);
      showError('Errore di rete');
    }
  }

  function cancelChanges(){
    clearMessages();
    if(!originalConfig) return;
    currentConfig = JSON.parse(JSON.stringify(originalConfig));
    renderConfig(currentConfig);
    showStatus('↩️ Modifiche annullate');
    schedulePreview(true);
  }

  function isoDatePlus(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

  // Sensitivity samples (intentionally low-signal to avoid clamping to 100)
  const SAMPLE_CLIENT = {
  "client_id": "C-DEMO-SENSITIVE-01",
  "email": "cliente.sensitive@email.it",
  "phone": "3331234567",
  "preferred_channel": "PHONE",
  "whatsapp_enabled": true,

  "last_contact_days": 92,
  "birthday_days": null,
  "anniversary_days": null,

  "unpaid_days": [],
  "cross_sell_gaps": ["HOME", "VITA"],

  "viva_points": 1200,
  "viva_points_expiring": 50,
  "viva_enrolled": true,
  "checkup_done": false,

  "customer_tenure_years": 8,
  "active_policies_count": 2,
  "agency_profitability": 900,
  "company_profitability_sp": 0.55,
  "auto_premium_normalized": 1200,
  "auto_guarantees_weight_vct": 1.0,
  "non_auto_premium_total": 1800,

  "policies": [
    {
      "policy_number": "P-CHURN-BORDER",
      "product": "AUTO",
      "premium": 900,
      "expiry_date": "2026-06-02",
      "churn_rate": 0.36
    },
    {
      "policy_number": "P-NONAUTO",
      "product": "HOME",
      "premium": 1800,
      "expiry_date": "2026-06-20",
      "churn_rate": 0.18
    }
  ],

  "active_campaigns": [
    { "campaign_id": "CAMP-SENS-01", "name": "Promo Cross-Sell", "product_scope": "VITA", "end_date": "2026-06-10" }
  ],
  "pending_quotes": [
    { "quote_id": "Q-SENS-01", "product": "VITA", "saved_at": "2026-05-10", "coverage_start_date": "2026-06-05", "status": "PENDING" }
  ],

  "claims": null,
  "complaints": null
  };

  const SAMPLE_LEAD = {
  "lead_id": "L-DEMO-SENSITIVE-01",
  "product": "AUTO",
  "marketing_consent": true,

  "created_hours_ago": 47,
  "last_contact_days": null,

  "quote_premium": 1900,
  "coverage_start_days": 14,

  "email": "lead.sensitive@email.it",
  "phone": "3337778888",
  "preferred_channel": "EMAIL",
  "whatsapp_enabled": false
};

  function initSamples(){
    SAMPLE_CLIENT.policies[0].expiry_date = isoDatePlus(120);
    const cpre = document.getElementById('sampleClientJson');
    const lpre = document.getElementById('sampleLeadJson');
    if(cpre) cpre.textContent = JSON.stringify(SAMPLE_CLIENT, null, 2);
    if(lpre) lpre.textContent = JSON.stringify(SAMPLE_LEAD, null, 2);
  }

  function renderActions(targetDiv, actions){
    const a = Array.isArray(actions) ? actions : [];
    if(!targetDiv) return;

    if(!a.length){
      targetDiv.innerHTML = '<div class="hint">Nessuna azione</div>';
      return;
    }

    const sorted = a.slice().sort((x,y)=>{
      const xp = (x.priority_within_task === 'PRIMARY' || x.primary === true);
      const yp = (y.priority_within_task === 'PRIMARY' || y.primary === true);
      if(xp !== yp) return xp ? -1 : 1;
      return 0;
    });

    targetDiv.innerHTML = sorted.map(x=>{
      const isP = (x.priority_within_task === 'PRIMARY' || x.primary === true);
      return (
        '<div class="actionLine ' + (isP?'actionPrimary':'') + '">' +
          (isP ? '⭐ ' : '') +
          '<b>['+esc(x.action_category)+']</b> ' +
          esc(x.recommended_action) +
          ' → ' + esc(x.recommended_channel) +
        '</div>'
      );
    }).join('');
  }

  function schedulePreview(immediate){
    if(!currentConfig) return;
    if(_timer) clearTimeout(_timer);
    const delay = immediate ? 0 : 250;

    _timer = setTimeout(async ()=>{
      try{
        initSamples();

        const rc = await fetch('/nba/client/preview?debug=false', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({client: SAMPLE_CLIENT, config: currentConfig})
        });

        if(rc.status === 204){
          const m = document.getElementById('previewClientMeta');
          const a = document.getElementById('previewClientActions');
          if(m) m.textContent = 'Nessuna NBA (204)';
          if(a) a.innerHTML = '';
        }else{
          const dc = await rc.json();
          const m = document.getElementById('previewClientMeta');
          if(m) m.textContent = 'score ' + dc.priority_score + ' ('+dc.priority_tier+') — ' + (dc.strategic_category||'-') + ' — ' + (dc.presentation_mode||'-');
          renderActions(document.getElementById('previewClientActions'), dc.recommended_actions);
        }

        const rl = await fetch('/nba/lead/preview?debug=false', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({lead: SAMPLE_LEAD, config: currentConfig})
        });

        if(rl.status === 204){
          const m = document.getElementById('previewLeadMeta');
          const a = document.getElementById('previewLeadActions');
          if(m) m.textContent = 'Nessuna NBA (204)';
          if(a) a.innerHTML = '';
        }else{
          const dl = await rl.json();
          const m = document.getElementById('previewLeadMeta');
          if(m) m.textContent = 'score ' + dl.priority_score + ' ('+dl.priority_tier+') — ' + (dl.strategic_category||'-') + ' — ' + (dl.presentation_mode||'-');
          renderActions(document.getElementById('previewLeadActions'), dl.recommended_actions);
        }

      }catch(e){
        console.error(e);
        const m1 = document.getElementById('previewClientMeta');
        const m2 = document.getElementById('previewLeadMeta');
        if(m1) m1.textContent = 'Errore preview (vedi console)';
        if(m2) m2.textContent = 'Errore preview (vedi console)';
      }
    }, delay);
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    const bSave   = document.getElementById('btnSave');
    const bCancel = document.getElementById('btnCancel');
    const bPrev   = document.getElementById('btnPreview');

    if(bSave)   bSave.addEventListener('click', saveConfig);
    if(bCancel) bCancel.addEventListener('click', cancelChanges);
    if(bPrev)   bPrev.addEventListener('click', ()=>schedulePreview(true));

    loadConfig();
  });

})();
