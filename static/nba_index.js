// NBA_Index page logic
(function(){
  'use strict';
  const esc = window.NBA.esc;
  NBA.log('[NBA UI] loaded: NBA_Index');

  function renderActions(actions){
    const a = Array.isArray(actions)?actions:[];
    if(!a.length) return '<i>—</i>';
    const sorted = a.slice().sort((x,y)=>{
      const xp = (x.priority_within_task==='PRIMARY'||x.primary===true);
      const yp = (y.priority_within_task==='PRIMARY'||y.primary===true);
      if(xp!==yp) return xp?-1:1;
      return 0;
    });
    return '<ul style="margin:0;padding-left:18px">'+sorted.map(x=>{
      const isP = (x.priority_within_task==='PRIMARY'||x.primary===true);
      const cls = isP?'primary':'secondary';
      return `<li class="${cls}"><b>[${esc(x.action_category)}]</b> ${esc(x.recommended_action)} <span class="badge">${esc(x.recommended_channel)}</span></li>`;
    }).join('')+'</ul>';
  }

  function renderBulkTable(rows, kind){
    const idKey = (kind==='leads')?'lead_id':'client_id';
    const jsonKey = (kind==='leads')?'lead_json':'client_json';
    return `
      <table>
        <thead>
          <tr>
            <th>${idKey}</th>
            <th>Score / Tier</th>
            <th>Strategia</th>
            <th>Azioni</th>
            <th>JSON</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>{
            const score = (r.priority_score===null||r.priority_score===undefined)?'—':r.priority_score;
            const tier = r.priority_tier||'—';
            const strat = r.strategic_category||'—';
            const pm = r.presentation_mode||'—';
            return `
              <tr>
                <td><code>${esc(r[idKey])}</code></td>
                <td><b>${esc(score)}</b> / ${esc(tier)}</td>
                <td>${esc(strat)}<div class="hint">${esc(pm)}</div></td>
                <td>${renderActions(r.nba)}</td>
                <td><pre class="jsoncol">${esc(JSON.stringify(r[jsonKey],null,2))}</pre></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function loadBulk(){
    const kind = document.getElementById('bulkType').value;
    const n = Math.max(1, Math.min(200, parseInt(document.getElementById('bulkN').value||'10',10)));
    const url = (kind==='leads') ? `/nba/leads?n=${n}` : `/nba/clients?n=${n}`;
    document.getElementById('bulkStatus').textContent = 'Loading…';
    document.getElementById('bulkTable').innerHTML = '';
    try{
      const r = await fetch(url);
      if(!r.ok){
        document.getElementById('bulkStatus').textContent = `Errore (${r.status})`;
        return;
      }
      const data = await r.json();
      document.getElementById('bulkStatus').textContent = `OK: ${data.length} record`;
      document.getElementById('bulkTable').innerHTML = renderBulkTable(data, kind);
    }catch(e){
      console.error(e);
      document.getElementById('bulkStatus').textContent = 'Errore (vedi console)';
    }
  }

  async function loadSingle(){
    const kind = document.getElementById('singleType').value;
    const id = (document.getElementById('singleId').value||'').trim();
    if(!id){
      document.getElementById('singleStatus').textContent = 'Inserisci un ID.';
      return;
    }
    const url = (kind==='lead') ? `/nba/lead/?lead_id=${encodeURIComponent(id)}` : `/nba/client/?client_id=${encodeURIComponent(id)}`;
    document.getElementById('singleStatus').textContent = 'Loading…';
    document.getElementById('singleOut').innerHTML = '';
    try{
      const r = await fetch(url);
      if(r.status===204){
        document.getElementById('singleStatus').textContent = 'Nessuna NBA (204)';
        return;
      }
      if(!r.ok){
        document.getElementById('singleStatus').textContent = `Errore (${r.status})`;
        return;
      }
      const data = await r.json();
      document.getElementById('singleStatus').textContent = 'OK';
      const json = JSON.stringify(data,null,2);
      const trig = Array.isArray(data.triggers)?data.triggers:[];
      const trigHtml = trig.length ? trig.map(t=>`<span class="badge">${esc(t)}</span>`).join(' ') : '<i>—</i>';
      document.getElementById('singleOut').innerHTML = `
        <div class="hint"><b>Trigger:</b> ${trigHtml}</div>
        <div style="margin-top:10px"><b>Azioni</b></div>
        ${renderActions(data.recommended_actions)}
        <div style="margin-top:10px"><b>Raw JSON</b></div>
        <pre class="jsoncol" style="max-height:320px">${esc(json)}</pre>
      `;
    }catch(e){
      console.error(e);
      document.getElementById('singleStatus').textContent = 'Errore (vedi console)';
    }
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    const b1=document.getElementById('btnBulk');
    const b2=document.getElementById('btnSingle');
    if(b1) b1.addEventListener('click', loadBulk);
    if(b2) b2.addEventListener('click', loadSingle);
  });
})();
