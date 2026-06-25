// NBA_triggers page logic
(function(){
  'use strict';
  const esc = window.NBA && window.NBA.esc ? window.NBA.esc : (s)=>String(s ?? '');
  if(window.NBA && window.NBA.log) window.NBA.log('[NBA UI] loaded: NBA_triggers');

  let catalog = null;                 // resolved payload from GET /catalog/triggers
  let overrides = {client:{}, lead:{}}; // editable overrides
  let scope = 'client';

  const elTable  = document.getElementById('tableWrap');
  const elStatus = document.getElementById('status');
  const elError  = document.getElementById('error');
  const elRaw    = document.getElementById('rawOverrides');
  const elSearch = document.getElementById('search');
  const elMeta   = document.getElementById('meta');

  function clearMsg(){ elStatus.textContent=''; elError.textContent=''; }
  function showStatus(m){ clearMsg(); elStatus.textContent = m || ''; }
  function showError(m){ clearMsg(); elError.textContent = m || ''; }

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

  function syncRaw(){
    elRaw.value = JSON.stringify(overrides, null, 2);
  }

  function parseRaw(){
    try{
      const obj = JSON.parse(elRaw.value || '{}');
      obj.client = (obj.client && typeof obj.client==='object') ? obj.client : {};
      obj.lead   = (obj.lead   && typeof obj.lead==='object')   ? obj.lead   : {};
      overrides = obj;
      return obj;
    }catch(e){
      showError('Overrides JSON non valido');
      throw e;
    }
  }

  function getScopeData(){
    return (catalog && catalog[scope]) ? catalog[scope] : {};
  }

  function getOverridesFor(code){
    overrides[scope] ||= {};
    overrides[scope][code] ||= {};
    return overrides[scope][code];
  }

  function severitySelect(val){
    const v = String(val || 'LOW').toUpperCase();
    const opts = ['LOW','MEDIUM','HIGH','CRITICAL'];
    return '<select class="sev">' + opts.map(o =>
      '<option value="'+o+'"'+(o===v?' selected':'')+'>'+o+'</option>'
    ).join('') + '</select>';
  }

  function render(){
    const q = (elSearch.value || '').trim().toLowerCase();
    const data = getScopeData();

    let rows = Object.entries(data)
      .sort((a,b)=> (a[1].display_order??9999) - (b[1].display_order??9999) || a[0].localeCompare(b[0]));

    if(q){
      rows = rows.filter(([code,node])=>{
        const dn = String(node.display_name||'').toLowerCase();
        return code.toLowerCase().includes(q) || dn.includes(q);
      });
    }

    const total = Object.keys(data).length;
    elMeta.textContent = total ? ('items: ' + rows.length + ' / ' + total) : '';

    let html = '';
    html += '<table><thead><tr>' +
            '<th>Trigger</th><th>Enabled</th><th>Display name</th><th>Severity</th><th>Order</th><th>Thresholds</th><th>Payload schema</th><th>Type</th>' +
            '</tr></thead><tbody>';

    for(const [code,node] of rows){
      const ov = (overrides[scope] && overrides[scope][code]) ? overrides[scope][code] : {};

      const enabled     = (ov.enabled!==undefined)       ? !!ov.enabled       : !!node.enabled;
      const displayName = (ov.display_name!==undefined)  ? ov.display_name    : (node.display_name||code);
      const severity    = (ov.severity!==undefined)      ? ov.severity        : (node.severity||'LOW');
      const order       = (ov.display_order!==undefined) ? ov.display_order   : (node.display_order??9999);
      const isDoc       = !!node.doc_only;

      const thrVals = node.threshold_values || {};
      const thrHtml = Object.keys(thrVals).length
        ? Object.entries(thrVals).map(([k,v])=>'<span class="pill">'+esc(k)+': '+esc(v)+'</span>').join('')
        : '<span class="muted">—</span>';

      const ps    = (isDoc && ov.payload_schema) ? ov.payload_schema : (node.payload_schema || {});
      const psStr = JSON.stringify(ps);

      html += '<tr data-code="'+esc(code)+'">';
      html += '<td class="mono"><b>'+esc(code)+'</b></td>';
      html += '<td><input class="en" type="checkbox"'+(enabled?' checked':'')+'></td>';
      html += '<td><input class="dn" type="text" value="'+esc(displayName)+'" style="width:100%"></td>';
      html += '<td>'+severitySelect(severity)+'</td>';
      html += '<td><input class="ord" type="number" value="'+esc(order)+'"></td>';
      html += '<td>'+thrHtml+'</td>';
      html += isDoc
        ? '<td><textarea class="ps" style="min-height:60px">'+esc(psStr)+'</textarea></td>'
        : '<td class="muted mono">'+esc(psStr)+'</td>';
      html += '<td>'+(isDoc?'<span class="pill">doc-only</span>':'<span class="pill">base</span>')+'</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';
    elTable.innerHTML = html;

    // bind handlers
    elTable.querySelectorAll('tr[data-code]').forEach(tr=>{
      const code = tr.getAttribute('data-code');
      const ov = getOverridesFor(code);

      tr.querySelector('.en').addEventListener('change', (e)=>{ ov.enabled = !!e.target.checked; syncRaw(); });
      tr.querySelector('.dn').addEventListener('input',  (e)=>{ ov.display_name = e.target.value; syncRaw(); });
      tr.querySelector('.ord').addEventListener('input', (e)=>{ ov.display_order = parseInt(e.target.value||'0',10); syncRaw(); });
      tr.querySelector('.sev').addEventListener('change', (e)=>{ ov.severity = e.target.value; syncRaw(); });

      const ps = tr.querySelector('.ps');
      if(ps){
        ps.addEventListener('input', (e)=>{
          try{
            ov.payload_schema = JSON.parse(e.target.value || '{}');
            ps.style.borderColor = '';
          }catch(err){
            ps.style.borderColor = 'red';
          }
          syncRaw();
        });
      }
    });
  }

  async function loadCatalog(){
    clearMsg();
    try{
      showStatus('Loading...');
      const r = await fetch('/catalog/triggers');
      if(!r.ok){ showError('Errore caricamento catalogo ('+r.status+')'); return; }
      catalog = await r.json();
      overrides = deepClone(catalog.overrides || {client:{}, lead:{}});
      syncRaw();
      render();
      showStatus('Loaded');
    }catch(e){
      console.error(e);
      showError('Impossibile raggiungere la API /catalog/triggers. Verifica che il server NBA sia in esecuzione.');
    }
  }

  async function doValidate(){
    clearMsg();
    let payload;
    try{ payload = parseRaw(); }catch(e){ return; }
    try{
      showStatus('Validating...');
      const r = await fetch('/catalog/triggers/validate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await r.json();
      if(data.errors && data.errors.length){
        showError('Validation errors: '+data.errors.length);
        alert('ERRORS:\n'+data.errors.join('\n'));
        return;
      }
      if(data.warnings && data.warnings.length){
        alert('WARNINGS:\n'+data.warnings.join('\n'));
      }
      showStatus('Validated');
    }catch(e){
      console.error(e);
      showError('Errore validazione');
    }
  }

  async function doSave(){
    clearMsg();
    let payload;
    try{ payload = parseRaw(); }catch(e){ return; }
    try{
      showStatus('Saving...');
      const r = await fetch('/catalog/triggers', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(!r.ok){
        const err = await r.json().catch(()=>null);
        showError('Save failed ('+r.status+')');
        if(err && err.detail && err.detail.validation && err.detail.validation.errors){
          alert('ERRORS:\n'+err.detail.validation.errors.join('\n'));
        }
        return;
      }
      await loadCatalog();
      showStatus('Saved');
    }catch(e){
      console.error(e);
      showError('Errore salvataggio');
    }
  }

  function addDocOnly(){
    const code = prompt('Trigger code (e.g. MY_DOC_TRIGGER):');
    if(!code) return;
    const up = code.trim().toUpperCase();
    const dn = prompt('Display name (optional):', up) || up;

    let schemaObj = {};
    const schemaTxt = prompt('Payload schema JSON (optional):', '{"field":"string"}') || '{}';
    try{ schemaObj = JSON.parse(schemaTxt); }catch(e){ schemaObj = {}; }

    overrides[scope] ||= {};
    overrides[scope][up] = { enabled:false, display_name: dn, severity:'LOW', display_order:9999, payload_schema: schemaObj };
    syncRaw();
    render();
    alert('Doc-only trigger added to overrides. Click Save to persist.');
  }

  // wire events
  document.getElementById('btnReload').addEventListener('click', loadCatalog);
  document.getElementById('btnValidate').addEventListener('click', doValidate);
  document.getElementById('btnSave').addEventListener('click', doSave);
  document.getElementById('btnAddDoc').addEventListener('click', addDocOnly);

  document.querySelectorAll('input[name="scope"]').forEach(r=>{
    r.addEventListener('change', ()=>{ scope = r.value; render(); });
  });
  elSearch.addEventListener('input', ()=>render());

  // initial load
  loadCatalog();
})();