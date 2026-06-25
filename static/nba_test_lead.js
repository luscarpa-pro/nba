// NBA_test lead logic
(function(){
  'use strict';
  const esc = window.NBA.esc;
  NBA.log('[NBA UI] loaded: NBA_test lead');

  function numOrNull(v){
    const t=(v||'').trim();
    if(!t) return null;
    const n=Number(t);
    return Number.isFinite(n)?n:null;
  }

  function buildLead(){
    return {
      lead_id: document.getElementById('lead_id').value.trim(),
      product: document.getElementById('product').value.trim() || null,
      marketing_consent: document.getElementById('marketing_consent').value==='true',
      created_hours_ago: parseInt(document.getElementById('created_hours_ago').value||'0',10),
      last_contact_days: numOrNull(document.getElementById('last_contact_days').value),
      quote_premium: numOrNull(document.getElementById('quote_premium').value),
      coverage_start_days: numOrNull(document.getElementById('coverage_start_days').value),
      email: document.getElementById('email').value.trim() || null,
      phone: document.getElementById('phone').value.trim() || null,
      preferred_channel: document.getElementById('preferred_channel').value,
      whatsapp_enabled: document.getElementById('whatsapp_enabled').value==='true'
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
      return '<div class="actionLine '+(isP?'actionPrimary':'')+'">'+(isP?'⭐ ':'')+'<b>['+esc(x.action_category)+']</b> '+esc(x.recommended_action)+' <span style="opacity:.7">→ '+esc(x.recommended_channel)+'</span></div>';
    }).join('');
  }

  async function run(){
    const debug = document.getElementById('debug').checked;
    const lead = buildLead();
    document.getElementById('reqJson').textContent = JSON.stringify(lead,null,2);
    document.getElementById('meta').textContent = 'Loading…';
    document.getElementById('actions').innerHTML = '';
    try{
      const r = await fetch('/nba/lead/test?debug='+(debug?'true':'false'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(lead)});
      if(r.status===204){ document.getElementById('meta').textContent='Nessuna NBA (204)'; return; }
      if(!r.ok){ const err = await r.json().catch(()=>({})); document.getElementById('meta').textContent='Errore: '+(err.detail||r.status); return; }
      const data = await r.json();
      document.getElementById('meta').innerHTML = 'score <b>'+data.priority_score+'</b> ('+data.priority_tier+') — <b>'+(data.strategic_category||'-')+'</b> — '+(data.presentation_mode||'-');
      document.getElementById('actions').innerHTML = renderActions(data.recommended_actions);
    }catch(e){ console.error(e); document.getElementById('meta').textContent='Errore (vedi console)'; }
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    const btn=document.getElementById('btnRun');
    if(btn) btn.addEventListener('click', run);
    run();
  });
})();
